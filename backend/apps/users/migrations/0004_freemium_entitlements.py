# Generated manually for the VoiceVault freemium entitlement rollout.

import django.db.models.deletion
from django.db import migrations, models


def backfill_plan_fields(apps, schema_editor):
    User = apps.get_model('users', 'User')
    for user in User.objects.all():
        if user.payment_completed:
            user.plan_type = 'premium'
            user.package_tier = 'premium'
            user.is_premium = True
            user.lifetime_access = True
            if not user.premium_purchased_at:
                user.premium_purchased_at = user.updated_at
        else:
            user.plan_type = 'free'
            user.package_tier = 'free'
            user.is_premium = False
            user.lifetime_access = False
        user.save(update_fields=[
            'plan_type',
            'package_tier',
            'is_premium',
            'lifetime_access',
            'premium_purchased_at',
        ])


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_single_membership_plan'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='package_tier',
            field=models.CharField(choices=[('free', 'Memory Starter'), ('premium', 'VoiceVault')], default='free', max_length=20),
        ),
        migrations.AddField(
            model_name='user',
            name='plan_type',
            field=models.CharField(choices=[('free', 'Free'), ('premium', 'Premium')], db_index=True, default='free', max_length=20),
        ),
        migrations.AddField(
            model_name='user',
            name='is_premium',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name='user',
            name='premium_purchased_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='lifetime_access',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='user',
            name='stripe_payment_intent_id',
            field=models.CharField(blank=True, db_index=True, max_length=255, null=True),
        ),
        migrations.CreateModel(
            name='UsageQuota',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('recording_minutes_used', models.FloatField(default=0)),
                ('recording_storage_used_mb', models.FloatField(default=0)),
                ('text_messages_used_this_month', models.IntegerField(default=0)),
                ('voice_responses_used_this_month', models.IntegerField(default=0)),
                ('family_invites_used', models.IntegerField(default=0)),
                ('ai_generations_used', models.IntegerField(default=0)),
                ('quota_reset_date', models.DateField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='usage_quota', to='users.user')),
            ],
            options={
                'db_table': 'usage_quotas',
                'indexes': [models.Index(fields=['quota_reset_date'], name='usage_quota_quota_r_05811b_idx')],
            },
        ),
        migrations.CreateModel(
            name='ConsentRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('consent_type', models.CharField(choices=[('voice_cloning', 'Voice Cloning'), ('ai_personality_generation', 'AI Personality Generation'), ('family_access', 'Family Access'), ('terms_of_service', 'Terms of Service'), ('privacy_policy', 'Privacy Policy')], max_length=100)),
                ('accepted', models.BooleanField(default=False)),
                ('accepted_at', models.DateTimeField(blank=True, null=True)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.TextField(blank=True)),
                ('consent_version', models.CharField(default='2026-05', max_length=50)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='consent_records', to='users.user')),
            ],
            options={
                'db_table': 'consent_records',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['user', 'consent_type'], name='consent_rec_user_id_0ff159_idx'),
                    models.Index(fields=['accepted'], name='consent_rec_accepte_f7c8a9_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='AuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(max_length=255)),
                ('target_type', models.CharField(max_length=100)),
                ('target_id', models.CharField(blank=True, max_length=255, null=True)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='audit_logs', to='users.user')),
            ],
            options={
                'db_table': 'audit_logs',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['user'], name='audit_logs_user_id_826ad1_idx'),
                    models.Index(fields=['action'], name='audit_logs_action_52d1a7_idx'),
                    models.Index(fields=['target_type', 'target_id'], name='audit_logs_target__2e9492_idx'),
                    models.Index(fields=['created_at'], name='audit_logs_created_a8d632_idx'),
                ],
            },
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['plan_type'], name='users_plan_ty_88af38_idx'),
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['is_premium'], name='users_is_prem_1c1c6c_idx'),
        ),
        migrations.RunPython(backfill_plan_fields, migrations.RunPython.noop),
    ]
