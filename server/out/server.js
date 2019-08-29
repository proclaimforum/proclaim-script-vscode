"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
const vscode_languageserver_1 = require("vscode-languageserver");
const parser_1 = require("./parser");
// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = vscode_languageserver_1.createConnection(vscode_languageserver_1.ProposedFeatures.all);
// Create a simple text document manager. The text document manager
// supports full document sync only
let documents = new vscode_languageserver_1.TextDocuments();
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
connection.onInitialize((params) => {
    let capabilities = params.capabilities;
    // Does the client support the `workspace/configuration` request?
    // If not, we will fall back using global settings
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    hasDiagnosticRelatedInformationCapability = !!(capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation);
    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
            // Tell the client that the server supports code completion
            completionProvider: {
                resolveProvider: true
            },
            // Tell the client that the server supports document Symbols
            documentSymbolProvider: true
        }
    };
});
connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(vscode_languageserver_1.DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
});
// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings = { maxNumberOfProblems: 1000 };
let globalSettings = defaultSettings;
// Cache the settings of all open documents
let documentSettings = new Map();
connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        // Reset all cached document settings
        documentSettings.clear();
    }
    else {
        globalSettings = ((change.settings.languageServerExample || defaultSettings));
    }
    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});
function getDocumentSettings(resource) {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'languageServerExample'
        });
        documentSettings.set(resource, result);
    }
    return result;
}
// Only keep settings for open documents
documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
});
// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});
function validateTextDocument(textDocument) {
    return __awaiter(this, void 0, void 0, function* () {
        // In this simple example we get the settings for every validate run.
        let settings = yield getDocumentSettings(textDocument.uri);
        // The validator creates diagnostics for all uppercase words length 2 and more
        let text = textDocument.getText();
        let pattern = /\b[A-Z]{2,}\b/g;
        let m;
        let problems = 0;
        let diagnostics = [];
        while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
            problems++;
            let diagnostic = {
                severity: vscode_languageserver_1.DiagnosticSeverity.Warning,
                range: {
                    start: textDocument.positionAt(m.index),
                    end: textDocument.positionAt(m.index + m[0].length)
                },
                message: `${m[0]} is all uppercase!!!.`,
                source: 'ex'
            };
            if (hasDiagnosticRelatedInformationCapability) {
                diagnostic.relatedInformation = [
                    {
                        location: {
                            uri: textDocument.uri,
                            range: Object.assign({}, diagnostic.range)
                        },
                        message: 'Spelling matters'
                    },
                    {
                        location: {
                            uri: textDocument.uri,
                            range: Object.assign({}, diagnostic.range)
                        },
                        message: 'Particularly for names'
                    }
                ];
            }
            diagnostics.push(diagnostic);
        }
        // Send the computed diagnostics to VSCode.
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    });
}
connection.onDidChangeWatchedFiles(_change => {
    // Monitored files have change in VSCode
    connection.console.log('We received an file change event');
});
// This handler provides the initial list of the completion items.
connection.onCompletion((_textDocumentPosition) => {
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.
    return [
        {
            label: 'TypeScript',
            kind: vscode_languageserver_1.CompletionItemKind.Text,
            data: 1
        },
        {
            label: 'JavaScript',
            kind: vscode_languageserver_1.CompletionItemKind.Text,
            data: 2
        }
    ];
});
// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item) => {
    if (item.data === 1) {
        item.detail = 'TypeScript details';
        item.documentation = 'TypeScript documentation';
    }
    else if (item.data === 2) {
        item.detail = 'JavaScript details';
        item.documentation = 'JavaScript documentation';
    }
    return item;
});
connection.onDocumentSymbol(onDocumentSymbol);
//change to async then promise.resolve
function onDocumentSymbol(documentSymbol) {
    console.log('Server.onDocumentSymbol', documentSymbol);
    //console.log("onDocumentSymbol...");
    //const path = utils.uriToPath(documentSymbol.textDocument.uri);
    // Create an SymbolInformation[] Object to pass as result
    const symbolInformationResult = [];
    // Form local variables for changed doc uri (preliminary code is for DocumentSymbol not workspace-wide)
    const uri = documentSymbol.textDocument.uri;
    const thisdoc = documents.get(uri);
    /*
      const filePath = _filePathFromUri(documentSymbol.textDocument.uri);
      const file = workspace.getFile(filePath);
      if (!file) {
          */
    /*
    let m2: RegExpExecArray | null;
    let pattern2 = /\b[A-Z]{2,}\b/g;
    //let text2 = doc.getText();
    ##lwr text1  documentSymbol.textDocument.getText();
    let mysymbol : SymbolInformation = {
        name: 'bob',
        kind: SymbolKind.Field,
        range: {
            start: doc.positionAt(m.index),
            end: doc.positionAt(m2.index + m2[0].length)
        },
    uri: uri
    };
        symbols.push(mysymbol);
*/
    //let text = doc.getText();
    //let pattern = /\b[A-Z]{2,}\b/g;
    /*
        var mysymb;
    myrange = Range.create(1, 1,2 , 0);
    mysymb = SymbolInformation.create('dbfield1', 2, myrange, uri,undefined);
    symbols.push(mysymb);
    mysymb = SymbolInformation.create('dbfield2', 2, myrange, uri, 'dbfield1');
    symbols.push(mysymb);
    mysymb = SymbolInformation.create('var1', 5, myrange, uri, 'dbfield1');
    symbols.push(mysymb);
    mysymb = SymbolInformation.create('var2', 5, myrange, uri, 'dbfield1');
    symbols.push(mysymb);
    mysymb = SymbolInformation.create('string1', 6, myrange, uri, 'dbfield1');
    symbols.push(mysymb);
    mysymb = SymbolInformation.create('string2', 6, myrange, uri, 'dbfield1');
    symbols.push(mysymb);
    //mysymb = SymbolInformation.create(name: 'html', kind: SymbolKind.Field, containerName: '', location: Location.create(TEST_URI, Range.create(0, 0, 0, 37)));

*/
    // Retrieve list of symbols by passing document to parser
    const symbols = parser_1.ParseDocument(thisdoc);
    //for each symbok, construct a SymbolInformation Object, and push to result array
    for (const symbol of symbols) {
        //check this works.. - substitution for lineAt(symbol.line).range
        //const pLoc = Location.create(document.baseURI, vscode.Range.create(symbol.line, -1, symbol.line, Number.MAX_VALUE));
        //const symbolInformation = SymbolInformation.create(symbol.name,symbol.type,'',pLoc);
        // What is the document range that covers this symbol?
        // Expand with container name for nested?
        const symbolRange = vscode_languageserver_1.Range.create(symbol.line, 0, symbol.line, Number.MAX_VALUE);
        // Construct symbolInformation Object
        const symbolInformation = vscode_languageserver_1.SymbolInformation.create(symbol.name, symbol.type, symbolRange);
        // Finally, push the symbol to output array
        symbolInformationResult.push(symbolInformation);
    }
    return symbolInformationResult;
}
/*
connection.onDidOpenTextDocument((params) => {
    // A text document got opened in VSCode.
    // params.uri uniquely identifies the document. For documents store on disk this is a file URI.
    // params.text the initial full content of the document.
    connection.console.log(`${params.textDocument.uri} opened.`);
});
connection.onDidChangeTextDocument((params) => {
    // The content of a text document did change in VSCode.
    // params.uri uniquely identifies the document.
    // params.contentChanges describe the content changes to the document.
    connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});
connection.onDidCloseTextDocument((params) => {
    // A text document got closed in VSCode.
    // params.uri uniquely identifies the document.
    connection.console.log(`${params.textDocument.uri} closed.`);
});
*/
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
// Listen on the connection
connection.listen();
//# sourceMappingURL=server.js.map