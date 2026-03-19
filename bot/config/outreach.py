from ._runtime import export_section


export_section("outreach", globals())
default_role = globals().get("default_role", "")
default_company = globals().get("default_company", "")
default_recruiter_search_context = globals().get("default_recruiter_search_context", "")
default_message_content = globals().get("default_message_content", "")
use_ai_for_outreach = globals().get("use_ai_for_outreach", False)
attach_default_resume = globals().get("attach_default_resume", False)
max_outreaches_per_run = globals().get("max_outreaches_per_run", 5)
max_outreaches_per_day = globals().get("max_outreaches_per_day", 10)
require_review_before_send = globals().get("require_review_before_send", True)
collect_recruiter_email_if_available = globals().get("collect_recruiter_email_if_available", True)
run_type = globals().get("run_type", "apply")
__all__ = sorted(
    set(
        __all__
        + [
            "default_role",
            "default_company",
            "default_recruiter_search_context",
            "default_message_content",
            "use_ai_for_outreach",
            "attach_default_resume",
            "max_outreaches_per_run",
            "max_outreaches_per_day",
            "require_review_before_send",
            "collect_recruiter_email_if_available",
            "run_type",
        ]
    )
)
