import pymysql
pymysql.install_as_MySQLdb()

import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UP_SFMS.settings")
application = get_wsgi_application()