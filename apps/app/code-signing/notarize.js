import { notarize } from '@electron/notarize'

export default async function (context) {
  const { electronPlatformName, appOutDir } = context

  if (electronPlatformName !== 'darwin') {
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = `${appOutDir}/${appName}.app`

  // Get credentials from environment variables
  const appleId = process.env.APPLE_ID
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD
  const teamId = process.env.APPLE_TEAM_ID

  if (!appleId || !appleIdPassword || !teamId) {
    throw new Error(
      'Missing required environment variables for notarization: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID'
    )
  }

  console.log(`Starting notarization for ${appPath}...`)

  try {
    await notarize({
      appPath,
      appleId,
      appleIdPassword,
      teamId
    })

    console.log('Notarization completed successfully!')
  } catch (error) {
    console.error('Notarization failed:', error)
    throw error
  }
}
