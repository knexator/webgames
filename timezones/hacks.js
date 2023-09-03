// Build fonts into ./src
import generateBMFont from 'msdf-bmfont-xml'
import { writeFile } from 'fs'

generateBMFont(
  './src/fonts/consolas.ttf',
  {
    outputType: 'json',
    fontSize: 30,
    smartSize: true,
    square: true,
    border: 1
  },
  (error, textures, font) => {
    if (error) throw error
    textures.forEach((texture, index) => {
      writeFile(texture.filename + '.png', texture.texture, err => {
        if (err) throw err
      })
    })
    writeFile(font.filename, font.data, err => {
      if (err) throw err
    })
  }
)
