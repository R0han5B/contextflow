import os

import requests


def _extract_message_content(payload: dict) -> str:
    """Handle the different content shapes OpenRouter may return."""
    choices = payload.get("choices") or []
    if not choices:
        raise RuntimeError(f"OpenRouter returned no choices: {payload}")

    message = choices[0].get("message") or {}
    content = message.get("content")

    if isinstance(content, str) and content.strip():
        return content.strip()

    if isinstance(content, list):
        text_parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text" and item.get("text"):
                text_parts.append(str(item["text"]))

        combined = "\n".join(part.strip() for part in text_parts if part and part.strip()).strip()
        if combined:
            return combined

    error_message = payload.get("error", {}).get("message")
    if error_message:
        raise RuntimeError(f"OpenRouter error: {error_message}")

    raise RuntimeError(f"OpenRouter returned empty content: {payload}")


def chat_completion(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
    max_tokens: int = 700,
) -> str:
    """Send a raw chat completion request to OpenRouter."""
    api_key = os.getenv("OPENROUTER_API_KEY")
    model = os.getenv("OPENROUTER_MODEL", "mistralai/mistral-7b-instruct:free")
    openrouter_url = os.getenv(
        "OPENROUTER_API_URL",
        "https://openrouter.ai/api/v1/chat/completions",
    )

    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    response = requests.post(
        openrouter_url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Context Flow",
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        },
        timeout=90,
    )
    response.raise_for_status()
    payload = response.json()
    return _extract_message_content(payload)
