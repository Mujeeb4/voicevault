from django.db import migrations, models


def blank_payment_intents_to_null(apps, schema_editor):
    """Rows created before this migration stored '' for a missing payment intent."""
    CreditPurchase = apps.get_model('payments', 'CreditPurchase')
    CreditPurchase.objects.filter(stripe_payment_intent_id='').update(stripe_payment_intent_id=None)


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0004_creditpurchase'),
    ]

    operations = [
        migrations.AlterField(
            model_name='creditpurchase',
            name='stripe_checkout_session_id',
            field=models.CharField(blank=True, max_length=255, null=True, unique=True),
        ),
        migrations.AlterField(
            model_name='creditpurchase',
            name='stripe_payment_intent_id',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.RunPython(blank_payment_intents_to_null, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='creditpurchase',
            name='stripe_payment_intent_id',
            field=models.CharField(blank=True, max_length=255, null=True, unique=True),
        ),
    ]
