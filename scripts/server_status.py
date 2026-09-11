"""Read Farlands A2S_INFO; optionally publish a snapshot to a data-only branch."""
import base64
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import socket
import struct
import urllib.error
import urllib.request

ADDRESS = ('83.143.117.49', 20415)
QUERY = b'\xff\xff\xff\xffTSource Engine Query\0'


def parse_info(data):
    if data[:5] != b'\xff\xff\xff\xffI':
        raise ValueError('Unexpected A2S response')
    pos = 6

    def string():
        nonlocal pos
        end = data.index(0, pos)
        value = data[pos:end].decode('utf-8', 'replace')
        pos = end + 1
        return value

    name = string()
    for _ in range(3):
        string()
    pos += 2  # Steam app ID
    players, maximum = struct.unpack_from('BB', data, pos)
    pos += 7  # players, max, bots, type, environment, visibility, VAC
    protocol_version = string()

    game_version = None
    keywords = None
    if pos < len(data):
        edf = data[pos]
        pos += 1
        if edf & 0x80:  # game port
            pos += 2
        if edf & 0x10:  # SteamID
            pos += 8
        if edf & 0x40:  # SourceTV port + name
            pos += 2
            string()
        if edf & 0x20:  # keywords/tags; Valheim stores its build here
            keywords = string()
            match = re.search(r'(?<!\d)(\d+\.\d+\.\d+)(?!\d)', keywords)
            if match:
                game_version = match.group(1)
        if edf & 0x01:  # 64-bit game ID
            pos += 8

    return {
        'name': name,
        'players': players,
        'maxPlayers': maximum,
        'version': game_version,
        'protocolVersion': protocol_version or None,
        'keywords': keywords,
    }


def query():
    for attempt in range(3):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                sock.settimeout(4)
                sock.connect(ADDRESS)
                sock.send(QUERY)
                data = sock.recv(65535)
                if data[:5] == b'\xff\xff\xff\xffA':
                    if len(data) < 9:
                        raise ValueError('Truncated challenge')
                    sock.send(QUERY + data[5:9])
                    data = sock.recv(65535)
                return {'state': 'online', **parse_info(data)}
        except (OSError, ValueError, IndexError, struct.error):
            if attempt == 2:
                # No response does not prove the game server itself is down.
                return {
                    'state': 'unreachable',
                    'players': None,
                    'maxPlayers': None,
                    'version': None,
                    'protocolVersion': None,
                    'keywords': None,
                }


def publish(snapshot):
    repository = os.environ['GITHUB_REPOSITORY']
    token = os.environ['GH_TOKEN']
    branch = 'server-status'

    def api(path, method='GET', payload=None):
        request = urllib.request.Request(
            f'https://api.github.com/repos/{repository}/{path}',
            data=json.dumps(payload).encode() if payload is not None else None,
            method=method,
            headers={'Authorization': f'Bearer {token}',
                     'Accept': 'application/vnd.github+json',
                     'Content-Type': 'application/json',
                     'User-Agent': 'Farlands-status'})
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.load(response)

    try:
        api(f'git/ref/heads/{branch}')
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
        api('git/refs', 'POST', {'ref': f'refs/heads/{branch}',
                               'sha': os.environ['GITHUB_SHA']})
    payload = {'message': '[CF-Pages-Skip] Update server status', 'branch': branch,
               'content': base64.b64encode(snapshot.encode()).decode()}
    try:
        current = api(f'contents/status.json?ref={branch}')
        payload['sha'] = current['sha']
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
    api('contents/status.json', 'PUT', payload)


if __name__ == '__main__':
    result = query()
    result['checkedAt'] = datetime.now(timezone.utc).isoformat()
    snapshot = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if os.environ.get('PUBLISH_STATUS') == '1':
        publish(snapshot)
    else:
        Path('status.json').write_text(snapshot, encoding='utf-8')
    print(snapshot)
