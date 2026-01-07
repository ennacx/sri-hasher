# 🛡️ Integrity SRI hasher
## 🧰 What is this tool?
This tool is intended for developers who want to understand and use SRI correctly.

## 🧭&nbsp;How to use
1. Enter the CDN URL of the resource you want to use, or upload the resource file directly.<br>
   (Only URLs that directly reference a file are supported. URLs that rely on query parameters are not supported.)
2. Click the &quot;Hash&quot; button.
3. Copy the generated SRI hash and paste it into the `integrity` attribute of the `<script>` or `<link>` tag.
4. If the resource cannot be fetched due to CORS restrictions, you can download the file and generate the SRI hash via file upload.
5. If you want to use the resource offline, you can use the function to upload and generate a resource file.

## 🧩&nbsp;What is SRI?
Subresource Integrity (SRI) is a security feature that allows browsers to verify that resources loaded from a CDN have not been modified.<br>
If the fetched resource does not match the expected hash value, the browser will block it.

For more details, please refer to the following documentation:
https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity

## ⚠️&nbsp;What happens if SRI is not specified?
If a resource is loaded from a CDN without an SRI hash, the browser will trust the content entirely based on the URL alone.

This means that if the resource is modified — intentionally or accidentally — the browser will still execute or apply it without any warning.

While CDNs are generally reliable, SRI provides an additional layer of protection by ensuring that the fetched resource is exactly the one you expect.

Even when using HTTPS, there are edge cases — such as certain DNS-related attacks — where an unexpected resource could be delivered.<br>
SRI helps mitigate such risks by verifying the integrity of the resource itself.

## 🔗&nbsp;Why is `crossorigin="anonymous"` required?
When using Subresource Integrity (SRI) with resources loaded from a CDN, the browser may perform a CORS-enabled request to verify the integrity of the resource.

In such cases, the `crossorigin="anonymous"` attribute is required to ensure that the resource is fetched without credentials and can be properly validated against the specified SRI hash.

Without this attribute, the browser may block the resource or fail the integrity check, even if the hash value itself is correct.

## 🤔&nbsp;Is that even possible?
In short: yes, but with limitations.

This tool runs entirely in your browser and uses standard Web APIs.<br>
When a CDN allows cross-origin access (CORS), the resource can be fetched directly and its SRI hash can be generated automatically.

However, if the CDN does not permit cross-origin access, the browser is not allowed to read the resource content. In such cases, automatic SRI generation from a URL is technically impossible due to browser security restrictions.

As a workaround, you can download the resource file manually and generate the SRI hash via file upload.<br>
This keeps the process secure and transparent.

## ⚙️&nbsp;Design philosophy
This is a developer-oriented utility for generating Subresource Integrity (SRI) hashes for CDN-hosted resources.

The purpose of this tool is not only to generate hash values, but also to help you understand how SRI works,
why it matters, and what limitations exist when using it in real-world web environments.

This tool intentionally follows standard browser security rules and does not bypass them.

## 📄&nbsp;Disclaimer
This tool retrieves CDN resources directly in your browser and generates SRI hash values locally. No data is stored or transmitted to any server.<br>
Please note that the author is not responsible for any issues that may arise from the use of this tool.

## 📜&nbsp;License</dt>
* [MIT](https://en.wikipedia.org/wiki/MIT_License)
* [CreativeCommons 4.0 BY-SA](https://creativecommons.org/licenses/by-sa/4.0/)
