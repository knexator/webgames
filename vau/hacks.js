// Build fonts into ./src
import generateBMFont from 'msdf-bmfont-xml'
import { writeFile, readdir } from 'fs'

let fonts_dir = './src/fonts/'
readdir(fonts_dir, (error, files) => {
  if (error) throw error
  files.forEach(file => {
    if (file.endsWith('.ttf') || file.endsWith('.otf')) {
      generateBMFont(
        fonts_dir + file,
        {
          outputType: 'json',
          fontSize: 26,
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
    }
  })
})
