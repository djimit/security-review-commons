import subprocess


def resolve_host(user_supplied_command):
    return subprocess.getoutput(user_supplied_command)
