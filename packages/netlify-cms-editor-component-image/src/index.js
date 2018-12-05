import React from 'react';

const image = {
  label: 'Image',
  id: 'image',
  fromBlock: match =>
    match && {
      image: match[2],
      alt: match[1],
    },
  toBlock: data => `![${data.alt || ''}](${data.image || ''})`,
  // eslint-disable-next-line react/display-name
  toPreview: (data, getAsset) => <img src={getAsset(data.image) || ''} alt={data.alt || ''} />,
  pattern: /^!\[(.*)\]\((.*)\)$/,
  fields: [
    {
      label: 'Image',
      name: 'image',
      widget: 'image',
      media_library: {
        allow_multiple: false,
      },
    },
    {
      label: 'Alt Text',
      name: 'alt',
    },
  ],
};

export default image;
