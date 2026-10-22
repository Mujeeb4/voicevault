from django.db import migrations, models


class Migration(migrations.Migration):
    """Add email_verified. Existing users are grandfathered as verified
    (AddField default=True backfills them), new users default to unverified."""

    dependencies = [
        ('users', '0006_user_phone_number'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='email_verified',
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name='user',
            name='email_verified',
            field=models.BooleanField(default=False),
        ),
    ]
