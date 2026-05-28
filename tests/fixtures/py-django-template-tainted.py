from django.http import HttpRequest, HttpResponse
from django.template import engines

def render_user_template(request: HttpRequest):
    tpl = request.GET.get('tpl', 'Hello')
    template = engines['django'].from_string(tpl)
    return HttpResponse(template.render({}))
