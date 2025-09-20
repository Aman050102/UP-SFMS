from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = "Test command discovery"

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("inventory_menu is visible ✅"))