from ._runtime import export_section


SECRETS_DEFAULTS = {
    "username": "",
    "password": "",
    "use_AI": False,
    "llm_api_url": "",
    "llm_api_key": "",
    "llm_model": "",
    "llm_spec": "openai",
    "ai_provider": "openai",
    "stream_output": False,
}


export_section("secrets", globals(), SECRETS_DEFAULTS)
