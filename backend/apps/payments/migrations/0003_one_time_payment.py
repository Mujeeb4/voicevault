# Generated manually for the VoiceVault one-time Premium checkout.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0002_single_membership_plan'),
    ]

    operations = [
        migrations.AlterField(
            model_name='payment',
            name='package_tier',
            field=models.CharField(choices=[('free', 'Memory Starter'), ('premium', 'VoiceVault')], max_length=20),
        ),
        migrations.AddField(
            model_name='payment',
            name='payment_type',
            field=models.CharField(choices=[('one_time', 'One-time')], default='one_time', max_length=20),
        ),
    ]
