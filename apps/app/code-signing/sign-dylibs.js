import { execSync } from 'child_process'
import { join } from 'path'
import { readdirSync } from 'fs'

export default async function (context) {
  const { electronPlatformName, appOutDir } = context

  if (electronPlatformName !== 'darwin') {
    return
  }

  // Skip signing if SKIP_NOTARIZE is set (local builds)
  if (process.env.SKIP_NOTARIZE === 'true') {
    console.log('Skipping dylib signing because SKIP_NOTARIZE is set to true.')
    return
  }

  const appName = context.packager.appInfo.productFilename
  const whisperPath = join(
    appOutDir,
    `${appName}.app`,
    'Contents',
    'Resources',
    'app.asar.unpacked',
    'resources',
    'whisper.cpp'
  )

  console.log(`Signing dylibs in ${whisperPath}...`)

  try {
    // Get all .dylib files
    const files = readdirSync(whisperPath)
    const dylibs = files.filter((file) => file.endsWith('.dylib'))

    // Find the signing identity from keychain
    // electron-builder will have imported the certificate by now (via CSC_LINK)
    let identity

    try {
      // List all available signing identities
      const identitiesOutput = execSync(
        'security find-identity -v -p codesigning',
        { encoding: 'utf-8' }
      )
      console.log('Available signing identities:', identitiesOutput)

      // Extract the first "Developer ID Application" identity
      const match = identitiesOutput.match(/"(Developer ID Application[^"]+)"/)
      if (match) {
        identity = match[1]
        console.log(`Found signing identity: ${identity}`)
      }
    } catch (error) {
      console.error('Failed to find signing identity:', error.message)
    }

    if (!identity) {
      console.warn('No signing identity found, skipping dylib signing')
      return
    }

    for (const dylib of dylibs) {
      const dylibPath = join(whisperPath, dylib)
      console.log(`Signing ${dylib}...`)

      try {
        execSync(`codesign --force --sign "${identity}" --timestamp "${dylibPath}"`, {
          stdio: 'inherit'
        })
      } catch (error) {
        console.error(`Failed to sign ${dylib}:`, error.message)
        throw error
      }
    }

    // Also sign the whisper binary
    const whisperBinary = join(whisperPath, 'whisper-darwin-arm64')
    console.log('Signing whisper-darwin-arm64...')
    execSync(`codesign --force --sign "${identity}" --timestamp "${whisperBinary}"`, {
      stdio: 'inherit'
    })

    console.log('All dylibs and whisper binary signed successfully!')
  } catch (error) {
    console.error('Signing failed:', error)
    throw error
  }
}
