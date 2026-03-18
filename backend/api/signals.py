"""
api/signals.py

Provides helper functions triggered after Payment saves to keep any
business-level cached totals up to date.

If your Business model does not have cached fields yet this file is still
required because models.py imports `update_business_summary` from here.
The function will silently no-op if the cached fields don't exist.
"""
import logging

logger = logging.getLogger(__name__)


def update_business_summary(business_id):
    """
    Refresh any cached aggregate totals on the Business record.

    Currently a safe no-op: imports are intentionally deferred to avoid
    circular imports, and the entire body is wrapped so it never crashes
    a live transaction. Extend this function if you add cached fields to
    the Business model later.
    """
    if not business_id:
        return

    try:
        from api.models import Business, Payment  # noqa

        from django.db.models import Sum

        inc = (
            Payment.objects.filter(
                business_id=business_id,
                direction=Payment.IN,
                is_deleted=False,
            ).aggregate(t=Sum("amount"))["t"] or 0
        )
        out = (
            Payment.objects.filter(
                business_id=business_id,
                direction=Payment.OUT,
                is_deleted=False,
            ).aggregate(t=Sum("amount"))["t"] or 0
        )

        # Only attempt to update fields that actually exist on the model
        update_kwargs = {}
        biz_fields = {f.name for f in Business._meta.get_fields()}
        if "cached_income"  in biz_fields: update_kwargs["cached_income"]  = inc
        if "cached_expense" in biz_fields: update_kwargs["cached_expense"] = out
        if "cached_balance" in biz_fields: update_kwargs["cached_balance"] = inc - out

        if update_kwargs:
            Business.objects.filter(pk=business_id).update(**update_kwargs)

    except Exception:
        # Never let a summary refresh crash a sale / payment transaction
        logger.warning(
            "update_business_summary: skipped for business_id=%s",
            business_id, exc_info=True,
        )
