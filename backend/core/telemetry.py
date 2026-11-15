import time
from uuid import uuid4
from .models import Telemetry

class Run:
    def __init__(self, app, emit):
        self.id = str(uuid4())
        self.app = app
        self.started = time.monotonic()
        self.telemetry = Telemetry()
        self.emit_callback = emit
        self.search_tasks = {}
        self.extract_tasks = {}

    async def emit(self, event, **data):
        await self.emit_callback(event, {'run_id':self.id,'t_ms':self.elapsed(),**data})

    def elapsed(self):
        return round((time.monotonic()-self.started)*1000)

    def finish(self):
        self.telemetry.total_ms = self.elapsed()
        return self.telemetry
