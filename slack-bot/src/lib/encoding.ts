export function bytesToHexString (args: {
    bytes: Uint8Array;
    hex?: string;
    index?: number;
}): { hex: string } {
    const {
        bytes,
        hex,
        index,
    } = {
        hex: "",
        index: 0,
        ...args,
    };

    if (index >= bytes.byteLength) {
        return { hex };
    }

    return bytesToHexString({
        bytes,
        hex: (function () {
            const char = bytes[index].toString(16);

            return `${hex}${char.length === 1 ? "0" : ""}${char}`;
        })(),
        index: index + 1,
    });
}
