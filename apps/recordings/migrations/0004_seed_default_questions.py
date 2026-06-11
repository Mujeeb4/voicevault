from django.db import migrations


DEFAULT_QUESTIONS = [
    ("Tell me about your earliest childhood memory.", "childhood", 1),
    ("What was your favorite thing to do as a child?", "childhood", 2),
    ("Describe your childhood home and neighborhood.", "childhood", 3),
    ("Who were your best friends growing up?", "childhood", 4),
    ("What did you want to be when you grew up?", "childhood", 5),
    ("Tell me about your parents and siblings.", "family", 6),
    ("What family traditions were most important to you?", "family", 7),
    ("Describe a memorable family vacation or gathering.", "family", 8),
    ("What values did your family instill in you?", "family", 9),
    ("How has your family shaped who you are today?", "family", 10),
    ("What was your first job?", "career", 11),
    ("Tell me about your career journey and major milestones.", "career", 12),
    ("What work are you most proud of?", "career", 13),
    ("Describe your biggest professional challenge.", "career", 14),
    ("What advice would you give about career success?", "career", 15),
    ("What is the most important lesson you've learned in life?", "wisdom", 16),
    ("What advice would you give your younger self?", "wisdom", 17),
    ("What does success mean to you?", "wisdom", 18),
    ("What does happiness mean to you?", "wisdom", 19),
    ("What legacy do you want to leave behind?", "wisdom", 20),
    ("Tell me about a difficult time you overcame.", "challenges", 21),
    ("What failure taught you the most?", "challenges", 22),
    ("How do you handle stress and adversity?", "challenges", 23),
    ("What gives you strength during hard times?", "challenges", 24),
    ("What would you do differently if you could?", "challenges", 25),
    ("How would your friends describe you?", "personality", 26),
    ("What are you passionate about?", "personality", 27),
    ("What makes you laugh?", "personality", 28),
    ("What are your core values?", "personality", 29),
    ("What brings you the most joy in life?", "personality", 30),
]


def seed_default_questions(apps, schema_editor):
    RecordingQuestion = apps.get_model("recordings", "RecordingQuestion")
    for question_text, domain, order in DEFAULT_QUESTIONS:
        RecordingQuestion.objects.get_or_create(
            domain=domain,
            order=order,
            defaults={
                "question_text": question_text,
                "is_active": True,
                "suggested_duration_seconds": 60,
            },
        )


def unseed_default_questions(apps, schema_editor):
    RecordingQuestion = apps.get_model("recordings", "RecordingQuestion")
    for question_text, domain, order in DEFAULT_QUESTIONS:
        RecordingQuestion.objects.filter(
            domain=domain,
            order=order,
            question_text=question_text,
        ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("recordings", "0003_alter_audiorecording_domain"),
    ]

    operations = [
        migrations.RunPython(seed_default_questions, unseed_default_questions),
    ]
