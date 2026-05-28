import subprocess


def run_command(argv):
    return subprocess.run(argv, check=True)
