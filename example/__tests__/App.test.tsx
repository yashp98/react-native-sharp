/**
 * @format
 */

jest.mock('react-native-sharp', () => {
  const chain = () => mockInstance
  const mockInstance = {
    resize: chain,
    crop: chain,
    rotate: chain,
    blur: chain,
    sharpen: chain,
    backgroundBlur: chain,
    roundCorners: chain,
    composite: chain,
    jpeg: chain,
    png: chain,
    webp: chain,
    toFile: async (path: string) => path,
    toBuffer: async () => new ArrayBuffer(8),
    metadata: async () => ({
      width: 2,
      height: 2,
      format: 'png',
      channels: 4,
      hasAlpha: true,
      size: 68,
    }),
  }
  const sharp = Object.assign(() => mockInstance, {
    vipsVersion: 'test',
    processMany: async (tasks: Array<() => Promise<unknown>>) =>
      Promise.all(tasks.map((task) => task())),
  })
  return { __esModule: true, default: sharp, sharp }
})

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(async () => ({ didCancel: true })),
}))

import React from 'react'
import ReactTestRenderer from 'react-test-renderer'
import App from '../App'

test('renders validation UI', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />)
  })
  expect(tree!.toJSON()).toBeTruthy()
})
