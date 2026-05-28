import os


def read_logs(user_supplied_command):
    return os.popen(user_supplied_command).read()
