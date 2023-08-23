import { DecapCmsApp as CMS } from 'decap-cms-app/dist/esm';
// Media libraries
import uploadcare from 'decap-cms-media-library-uploadcare';
import cloudinary from 'decap-cms-media-library-cloudinary';

CMS.registerMediaLibrary(uploadcare);
CMS.registerMediaLibrary(cloudinary);
