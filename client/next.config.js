/** @type {import('next').NextConfig} */
if (
  process.env.LD_LIBRARY_PATH == null ||
  !process.env.LD_LIBRARY_PATH.includes(
    `${process.env.PWD}/node_modules/canvas/build/Release:`
  )
) {
  process.env.LD_LIBRARY_PATH = `${
    process.env.PWD
  }/node_modules/canvas/build/Release:${process.env.LD_LIBRARY_PATH || ''}`
}

module.exports = {
  reactStrictMode: true,
  images: {
    unoptimized: true, // ➕ Add this line to allow next export
  },
}
