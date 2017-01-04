export default class AssetStore {
  constructor(config, authToken) {
    this.config = config;
    if (config.get('getSignedFormURL') == null) {
      throw 'The AssetStore integration needs the getSignedFormURL in the integration configuration.';
    }
    this.token = authToken;
    
    this.shouldConfirmUpload = config.get('shouldConfirmUpload', false);
    this.getSignedFormURL = config.get('getSignedFormURL');
  }

  parseJsonResponse(response) {
    return response.json().then((json) => {
      if (!response.ok) {
        return Promise.reject(json);
      }

      return json;
    });
  }

  urlFor(path, options) {
    const params = [];
    if (options.params) {
      for (const key in options.params) {
        params.push(`${ key }=${ encodeURIComponent(options.params[key]) }`);
      }
    }
    if (params.length) {
      path += `?${ params.join('&') }`;
    }
    return path;
  }


  requestHeaders(headers = {}) {
    return {
      ...headers,
    };
  }

  confirmRequest(assetID) {
    this.request(`${ this.getSignedFormURL }/${ assetID }`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ this.token }`,
      },
      body: JSON.stringify({ state: 'uploaded' }),
    });
  }


  request(path, options = {}) {
    const headers = this.requestHeaders(options.headers || {});
    const url = this.urlFor(path, options);
    return fetch(url, { ...options, headers }).then((response) => {
      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.match(/json/)) {
        return this.parseJsonResponse(response);
      }

      return response.text();
    });
  }

  upload(file) {
    return this.request(this.getSignedFormURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ this.token }`,
      },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        content_type: file.type,
      }),
    })
    .then((response) => {
      const formURL = response.form.url;
      const formFields = response.form.fields;
      const assetID = response.asset.id;
      const assetURL = response.asset.url;
      
      const formData = new FormData();
      Object.keys(formFields).forEach(key => formData.append(key, formFields[key]));
      formData.append('file', file, file.name);

      return this.request(formURL, {
        method: 'POST',
        body: formData,
      })
      .then(() => { 
        if (this.shouldConfirmUpload) this.confirmRequest(assetID);
        return { success: true, assetURL };
      });
    });
  }
}

