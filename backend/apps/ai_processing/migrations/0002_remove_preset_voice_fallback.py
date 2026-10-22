from django.db import migrations


def remove_preset_substitutions(apps, schema_editor):
    config_model = apps.get_model('ai_processing', 'AIConfiguration')
    queue_model = apps.get_model('ai_processing', 'ProcessingQueue')
    user_model = apps.get_model('users', 'User')
    alias = schema_editor.connection.alias
    preset = '21m00Tcm4TlvDq8ikWAM'
    affected = list(config_model.objects.using(alias).filter(voice_clone_id=preset).values_list('user_id', flat=True))
    config_model.objects.using(alias).filter(user_id__in=affected).update(
        voice_clone_id=None, voice_quality_score=None, quality_approved=False,
    )
    user_model.objects.using(alias).filter(id__in=affected).update(ai_ready=False, ai_processing_completed_at=None)
    queue_model.objects.using(alias).filter(
        user_id__in=affected, task_type='clone_voice', status='complete',
    ).update(
        status='failed',
        error_message='An older worker substituted a preset voice after cloning failed. Please retry voice cloning.',
        result_data=None,
    )


class Migration(migrations.Migration):
    dependencies = [('ai_processing', '0001_initial')]
    operations = [migrations.RunPython(remove_preset_substitutions, migrations.RunPython.noop)]
