import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
// The "legacy" entry keeps readAsStringAsync / StorageAccessFramework available on new Expo SDKs.
import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';

const SAF = FileSystem.StorageAccessFramework;
const FOLDER_FILE = `${FileSystem.documentDirectory}invoice_pdf_folder.txt`;

const readSavedFolder = async () => {
  try {
    const info = await FileSystem.getInfoAsync(FOLDER_FILE);
    if (!info.exists) return null;
    return (await FileSystem.readAsStringAsync(FOLDER_FILE)) || null;
  } catch {
    return null;
  }
};

const rememberFolder = async (uri) => {
  try {
    await FileSystem.writeAsStringAsync(FOLDER_FILE, uri);
  } catch {}
};

const askForFolder = async () => {
  const perm = await SAF.requestDirectoryPermissionsAsync();
  if (!perm.granted) return null;
  await rememberFolder(perm.directoryUri);
  return perm.directoryUri;
};

// Reads a local file as base64. Some Expo versions refuse the legacy read on the cache file that
// expo-print creates ("isn't readable"), so try the newer File API and then fetch() as fallbacks.
const readAsBase64 = async (uri) => {
  try {
    return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  } catch (e1) {
    try {
      return await new File(uri).base64();
    } catch (e2) {
      const blob = await (await fetch(uri)).blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('Could not read the PDF file'));
        reader.readAsDataURL(blob);
      });
    }
  }
};

const writeInto = async (dirUri, fileName, base64) => {
  const fileUri = await SAF.createFileAsync(dirUri, fileName, 'application/pdf');
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return fileUri;
};

/**
 * Saves a generated PDF (local file uri) into the phone's storage.
 *  - Android: the first time, the user picks a folder (e.g. Downloads); after that every
 *    PDF is saved there automatically with no dialog.
 *  - iOS has no shared storage folder, so the "Save to Files" sheet opens instead.
 * Returns { saved: true, where: 'device' | 'share' } or { saved: false } if the user declined.
 */
export const savePdfToDevice = async (pdfUri, fileName) => {
  const name = fileName.endsWith('.pdf') ? fileName.slice(0, -4) : fileName;

  if (Platform.OS !== 'android') {
    await Sharing.shareAsync(pdfUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    return { saved: true, where: 'share' };
  }

  const base64 = await readAsBase64(pdfUri);

  let dirUri = await readSavedFolder();
  if (dirUri) {
    try {
      await writeInto(dirUri, name, base64);
      return { saved: true, where: 'device' };
    } catch {
      // Folder was deleted or permission revoked - ask again below.
    }
  }

  dirUri = await askForFolder();
  if (!dirUri) return { saved: false };
  await writeInto(dirUri, name, base64);
  return { saved: true, where: 'device' };
};