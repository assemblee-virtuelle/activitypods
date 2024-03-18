const objectDepth = o => (Object(o) === o ? 1 + Math.max(-1, ...Object.values(o).map(objectDepth)) : 0);

const stream2buffer = stream => {
  return new Promise((resolve, reject) => {
    const _buf = [];
    stream.on('data', chunk => _buf.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(_buf)));
    stream.on('error', err => reject(err));
  });
};

module.exports = {
  objectDepth,
  stream2buffer
};
