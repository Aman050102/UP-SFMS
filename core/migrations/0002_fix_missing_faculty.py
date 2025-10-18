from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),  # ถ้าเลขล่าสุดของคุณไม่ใช่ 0001 ให้ใส่ตัวล่าสุดจริง ๆ
    ]

    operations = [
        migrations.AddField(
            model_name='borrowrecord',
            name='faculty',
            field=models.CharField(max_length=100, null=True, blank=True),
        ),
    ]