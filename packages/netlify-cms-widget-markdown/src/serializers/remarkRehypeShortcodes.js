import React from 'react';
import { map, has } from 'lodash';
import { renderToString } from 'react-dom/server';
import u from 'unist-builder';
import { NetlifyCmsCore as CMS } from 'netlify-cms-core';

/**
 * This plugin doesn't actually transform Remark (MDAST) nodes to Rehype
 * (HAST) nodes, but rather, it prepares an MDAST shortcode node for HAST
 * conversion by replacing the shortcode text with stringified HTML for
 * previewing the shortcode output.
 */
export default function remarkToRehypeShortcodes({ plugins, getAsset }) {
  return transform;

  function transform(root) {
    const transformedChildren = map(root.children, processShortcodes);
    return { ...root, children: transformedChildren };
  }

  /**
   * Mapping function to transform nodes that contain shortcodes.
   */
  function processShortcodes(node) {
    /**
     * If the node doesn't contain shortcode data, return the original node.
     */
    if (!has(node, ['data', 'shortcode'])) return node;

    /**
     * Get shortcode data from the node, and retrieve the matching plugin by
     * key.
     */
    const { shortcode, shortcodeData } = node.data;
    const plugin = plugins.get(shortcode);

    /**
     * Run the shortcode plugin's `toPreview` method, which will return either
     * an HTML string or a React component. If a React component is returned,
     * render it to an HTML string.
     */
    const value = getPreview(plugin, shortcodeData);
    const valueHtml = typeof value === 'string' ? value : renderToString(value);

    /**
     * Return a new 'html' type node containing the shortcode preview markup.
     */
    const textNode = u('html', valueHtml);
    const children = [textNode];
    return { ...node, children };
  }

  /**
   * Retrieve the shortcode preview component.
   */
  function getPreview(plugin, shortcodeData) {
    const { toPreview, widget } = plugin;
    if (toPreview) {
      return toPreview(shortcodeData, getAsset);
    }
    const preview = CMS.resolveWidget(widget);
    return React.createElement(preview.preview, {
      value: shortcodeData,
      field: plugin,
      getAsset,
    })
  }

}
