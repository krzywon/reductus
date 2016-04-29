import urllib2
import datetime
import StringIO
from os.path import basename

import pytz

from reflred.formats import nexusref
from reflred.iso8601 import seconds_since_epoch

DATA_SOURCES = {}

def check_datasource(source):
    if not source in DATA_SOURCES:
        raise RuntimeError("Need to set reflred.steps.load.DATA_SOURCES['" + source + "'] first!")

def url_load(fileinfo):
    from dataflow.modules.load import url_get
    path, mtime, entries = fileinfo['path'], fileinfo['mtime'], fileinfo['entries']
    name = basename(path)
    fid = StringIO.StringIO(url_get(fileinfo))
    nx_entries = nexusref.load_entries(name, fid, entries=entries)
    fid.close()
    return nx_entries

def find_mtime(path, source="ncnr"):
    check_datasource(source)
    try:
        url = urllib2.urlopen(DATA_SOURCES[source]+path)
        mtime = url.info().getdate('last-modified')
    except urllib2.HTTPError as exc:
        raise ValueError("Could not open %r\n%s"%(path, str(exc)))
    mtime_obj = datetime.datetime(*mtime[:7], tzinfo=pytz.utc)
    timestamp = seconds_since_epoch(mtime_obj)

    return { 'path': path, 'mtime': timestamp }


def url_load_list(files=None):
    if files is None: return []
    result = [entry for fileinfo in files for entry in url_load(fileinfo)]
    return result
