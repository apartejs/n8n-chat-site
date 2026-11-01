/**
 * The smallest WebSocket server the demo needs, with no dependency: the handshake, text frames
 * out, text and close frames in (RFC 6455). Enough for n8n's chat socket, which carries short
 * text frames one way and a JSON message now and then the other.
 */
import { createHash } from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/**
 * Accepts the upgrade; returns the socket's `send` and `close`, and calls `onText` per message.
 * `maxFrame` bounds a message (all its fragments together); past it the socket is dropped.
 */
export function acceptSocket(req, socket, onText, onClose, { maxFrame = 64 * 1024 } = {}) {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return null; }
    const accept = createHash('sha1').update(key + GUID).digest('base64');
    socket.write([
        'HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`, '', '',
    ].join('\r\n'));

    let open = true;
    const frame = (opcode, payload) => {
        if (!open) return;
        const body = Buffer.from(payload);
        const head = body.length < 126 ? Buffer.from([0x80 | opcode, body.length])
            : body.length < 65536 ? Buffer.from([0x80 | opcode, 126, body.length >> 8, body.length & 255])
                : (() => { const h = Buffer.alloc(10); h[0] = 0x80 | opcode; h[1] = 127; h.writeBigUInt64BE(BigInt(body.length), 2); return h; })();
        socket.write(Buffer.concat([head, body]));
    };
    const close = () => {
        if (!open) return;
        frame(0x8, Buffer.alloc(0));
        open = false;
        socket.end();
    };

    let buffer = Buffer.alloc(0);
    // A text message sent in fragments: its parts until the one marked final (FIN).
    let parts = null;
    let partsLength = 0;
    socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        for (;;) {
            if (buffer.length < 2) return;
            const fin = (buffer[0] & 0x80) !== 0;
            const opcode = buffer[0] & 0x0f;
            const masked = (buffer[1] & 0x80) !== 0;
            // A client must mask every frame (RFC 6455 §5.1); one that does not is not a browser.
            if (!masked) { socket.destroy(); return; }
            let length = buffer[1] & 0x7f;
            let offset = 2;
            if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4; }
            else if (length === 127) { if (buffer.length < 10) return; length = Number(buffer.readBigUInt64BE(2)); offset = 10; }
            if (length > maxFrame || partsLength + length > maxFrame) { socket.destroy(); return; }
            const maskAt = offset;
            offset += 4;
            if (buffer.length < offset + length) return;
            const data = Buffer.from(buffer.subarray(offset, offset + length));
            for (let i = 0; i < data.length; i++) data[i] ^= buffer[maskAt + (i % 4)];
            buffer = buffer.subarray(offset + length);
            if (opcode === 0x8) { close(); return; }
            if (opcode === 0x9) { frame(0xa, data); continue; }
            if (opcode === 0x1 || (opcode === 0x0 && parts)) {
                parts = opcode === 0x1 ? [data] : [...parts, data];
                partsLength = opcode === 0x1 ? data.length : partsLength + data.length;
                if (!fin) continue;
                const text = Buffer.concat(parts).toString('utf8');
                parts = null;
                partsLength = 0;
                try { onText(text); } catch (error) { console.error('[site] a socket message failed:', error); }
            }
        }
    });
    socket.on('close', () => { open = false; onClose?.(); });
    socket.on('error', () => { open = false; });
    return { send: (text) => frame(0x1, text), close, get open() { return open; } };
}
