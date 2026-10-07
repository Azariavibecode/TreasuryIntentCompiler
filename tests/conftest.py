"""Windows compatibility shim for gltest 0.2.16."""
import os
import tempfile

import gltest.direct.loader as loader


if os.name == "nt":
    _previous = None

    def _inject(vm):
        global _previous
        from genlayer.py import calldata
        from genlayer.py.types import Address

        convert = lambda value: Address(value) if isinstance(value, bytes) else value
        message = {
            "contract_address": convert(vm._contract_address),
            "sender_address": convert(vm.sender),
            "origin_address": convert(vm.origin),
            "stack": [],
            "value": vm._value,
            "datetime": vm._datetime,
            "is_init": False,
            "chain_id": vm._chain_id,
            "entry_kind": 0,
            "entry_data": b"",
            "entry_stage_data": None,
        }
        fd, path = tempfile.mkstemp()
        os.write(fd, calldata.encode(message))
        os.lseek(fd, 0, os.SEEK_SET)
        vm._original_stdin_fd = os.dup(0)
        os.dup2(fd, 0)
        os.close(fd)
        if _previous:
            try:
                os.unlink(_previous)
            except PermissionError:
                pass
        _previous = path

    loader._inject_message_to_fd0 = _inject
