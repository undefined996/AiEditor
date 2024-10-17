export const removeHtmlTag = (html: string, tagName: string): string => {
    const regex = new RegExp(`<${tagName}[^>]*>(.*?)<\/${tagName}>`, 'gi');
    return html.replace(regex, (_, innerContent) => innerContent);
}

export const removeHtmlTags = (html: string, tagNames: string[]): string => {
    for (let tagName of tagNames) {
        html = removeHtmlTag(html, tagName);
    }
    return html
}

export const cleanHtml = (html: string, preserveTags: string[], removeAttrs: boolean): string => {

    function clearChildren(element: HTMLElement) {
        const fragment = document.createDocumentFragment();
        while (element.firstChild) {
            const childNode = element.removeChild(element.firstChild);
            const cleanedChild = cleanNode(childNode);
            if (cleanedChild) {
                fragment.appendChild(cleanedChild);
            }
        }
        return fragment;
    }

    function cleanNode(node: Node): Node | null {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            if (preserveTags.includes(element.tagName.toLowerCase())) {
                const textContent = element.textContent?.trim() || "";
                if (!textContent) {
                    return element;
                }
                if (removeAttrs) {
                    while (element.attributes.length > 0) {
                        element.removeAttribute(element.attributes[0].name);
                    }
                }
                element.appendChild(clearChildren(element));
                return element;
            } else {
                return clearChildren(element);
            }
        } else if (node.nodeType === Node.TEXT_NODE) {
            return node;
        }
        return null;
    }

    function replaceDoubleBrWithP(container: HTMLElement) {
        const brElements = container.querySelectorAll('br');
        for (let i = 0; i < brElements.length - 1; i++) {
            const currentBr = brElements[i];
            const nextBr = brElements[i + 1];

            if (currentBr.nextSibling === nextBr) {
                let previousSibling = currentBr.previousSibling;
                const elementsToWrap: Node[] = [];
                while (previousSibling && previousSibling.nodeName !== "P") {
                    elementsToWrap.unshift(previousSibling);
                    previousSibling = previousSibling.previousSibling;
                }

                const pElement = document.createElement('p');
                elementsToWrap.forEach(el => pElement.appendChild(el));
                currentBr.replaceWith(pElement);
                nextBr.remove();

                i++
            }
        }
    }

    ////Windows would be \r\n, but Linux just uses \n and Apple uses \r.
    html = html.replace(/(\r\n|\n|\r)/gm, "");

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const cleanedContent = cleanNode(doc.body);
    const resultContainer = document.createElement('div');
    if (cleanedContent) {
        resultContainer.appendChild(cleanedContent);
        replaceDoubleBrWithP(resultContainer);
    }
    return resultContainer.outerHTML;
}


export const isExcelDocument = (document: Document) => {
    const attributeNames = document.documentElement.getAttributeNames();
    if (attributeNames && attributeNames.length > 0) {
        for (let attributeName of attributeNames) {
            const attribute = document.documentElement.getAttribute(attributeName);
            if (attribute?.includes("microsoft") || attribute?.includes("excel")) {
                return true;
            }
        }
    }

    let metaTags = document.getElementsByTagName('meta');
    for (let metaTag of metaTags) {
        let nameAttr = metaTag.getAttribute('name');
        let contentAttr = metaTag.getAttribute('content');
        if (nameAttr && nameAttr.toLowerCase() === 'generator' && (
            contentAttr?.includes("Microsoft")
            || contentAttr?.includes('LibreOffice')
            || contentAttr?.includes('OpenOffice'))) {
            return true;
        }
    }

    const innerHTML = document.body.innerHTML?.trim();
    return !!(innerHTML?.startsWith("<table") && innerHTML?.endsWith("</table>"));
}
