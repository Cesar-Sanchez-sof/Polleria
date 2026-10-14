"""Motores de inferencia. Importar este módulo **no** importa ``torch`` ni ``transformers``.

:class:`TransformersEngine` reproduce la carga de ``check_model.py`` del proyecto de entrenamiento
(NF4, doble cuantización, cómputo bf16, ``device_map={"": 0}``, ``local_files_only``) y aplica el
adaptador LoRA con PEFT en modo inferencia. Antes de quedar listo comprueba que:

- el adaptador declara el modelo base esperado y es LoRA;
- ``tokenizer.apply_chat_template`` coincide exactamente con ``render_chatml`` (plantilla del
  entrenamiento) y el ``eos_token`` es ``<|im_end|>``;
- hay GPU CUDA (no se ejecuta un 7B en CPU).

Generación: *greedy* (``do_sample=False``, ``num_beams=1``), parada en ``<|im_end|>`` o
``<|endoftext|>``; ``finish_reason="length"`` si se agotó ``max_new_tokens``.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from ai_service.sqlgen.profile import BASE_MODEL_ID
from ai_service.sqlgen.prompt import IM_END, STOP_TOKENS, render_chatml

from inference_server.config import ServerSettings


class EngineError(Exception):
    """Fallo del motor; ``code`` es un código fijo, sin rutas ni contenido."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Generation:
    text: str
    finish_reason: str
    output_tokens: int


class InferenceEngine(Protocol):
    adapter: str

    def load(self) -> None: ...

    def render(self, user_content: str) -> str: ...

    def count_tokens(self, rendered: str) -> int: ...

    def generate(self, rendered: str, max_new_tokens: int) -> Generation: ...


class TransformersEngine:
    def __init__(self, settings: ServerSettings) -> None:
        self._settings = settings
        self.adapter = settings.adapter_id
        self._torch: Any = None
        self._tokenizer: Any = None
        self._model: Any = None
        self._stop_ids: list[int] = []

    def load(self) -> None:
        # Nunca descargar: modelo base y adaptador deben estar ya en disco.
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"
        import torch
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

        if not torch.cuda.is_available():
            raise EngineError("CUDA_UNAVAILABLE")
        adapter_dir = Path(self._settings.adapter_dir)
        try:
            adapter_config = json.loads((adapter_dir / "adapter_config.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            raise EngineError("ADAPTER_NOT_READABLE") from None
        if adapter_config.get("base_model_name_or_path") != BASE_MODEL_ID or adapter_config.get("peft_type") != "LORA":
            raise EngineError("ADAPTER_INCOMPATIBLE")

        tokenizer = AutoTokenizer.from_pretrained(str(adapter_dir), local_files_only=True)
        probe = "probe"
        rendered = tokenizer.apply_chat_template(
            [{"role": "user", "content": probe}], tokenize=False, add_generation_prompt=True
        )
        if rendered != render_chatml(probe) or tokenizer.eos_token != IM_END:
            raise EngineError("TEMPLATE_MISMATCH")
        stop_ids = [tokenizer.convert_tokens_to_ids(token) for token in STOP_TOKENS]
        if any(not isinstance(token_id, int) or token_id < 0 for token_id in stop_ids):
            raise EngineError("TEMPLATE_MISMATCH")

        quantization = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=torch.bfloat16,
        )
        base = AutoModelForCausalLM.from_pretrained(
            BASE_MODEL_ID,
            cache_dir=self._settings.hf_hub_cache,
            local_files_only=True,
            quantization_config=quantization,
            device_map={"": 0},
            dtype=torch.bfloat16,
            low_cpu_mem_usage=True,
        )
        model = PeftModel.from_pretrained(base, str(adapter_dir), is_trainable=False)
        model.eval()
        self._torch, self._tokenizer, self._model, self._stop_ids = torch, tokenizer, model, stop_ids

    def render(self, user_content: str) -> str:
        return self._tokenizer.apply_chat_template(
            [{"role": "user", "content": user_content}], tokenize=False, add_generation_prompt=True
        )

    def count_tokens(self, rendered: str) -> int:
        return len(self._tokenizer(rendered, add_special_tokens=False)["input_ids"])

    def generate(self, rendered: str, max_new_tokens: int) -> Generation:
        inputs = self._tokenizer(rendered, return_tensors="pt", add_special_tokens=False).to("cuda:0")
        prompt_length = inputs["input_ids"].shape[1]
        with self._torch.inference_mode():
            output = self._model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                do_sample=False,
                num_beams=1,
                eos_token_id=self._stop_ids,
                pad_token_id=self._tokenizer.pad_token_id,
            )
        new_tokens = output[0][prompt_length:]
        finished = len(new_tokens) > 0 and int(new_tokens[-1]) in self._stop_ids
        text = self._tokenizer.decode(new_tokens, skip_special_tokens=True)
        return Generation(text=text, finish_reason="stop" if finished else "length", output_tokens=len(new_tokens))
