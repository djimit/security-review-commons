import yaml


def read_document(raw):
    return yaml.safe_load(raw)
