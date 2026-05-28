from django.http import HttpResponse
from django.template import loader

def render_safe(_request):
    template = loader.get_template('index.html')
    return HttpResponse(template.render({'title': 'Home'}))
