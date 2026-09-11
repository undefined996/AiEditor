import * as publicApi from './index'

// Keep the 1.x `new AiEditor()` global while exposing the remaining public API as static properties.
const AiEditorGlobal = Object.assign(publicApi.AiEditor, publicApi)

export default AiEditorGlobal
