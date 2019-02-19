import {
	createSourceFile,
	PropertySignature,
	Node,
	SyntaxKind,
	isIdentifier,
	isUnionTypeNode,
	isLiteralTypeNode,
	isNumericLiteral,
	isTypeNode,
	isTypeLiteralNode,
	isPropertySignature,
	LiteralExpression,
	LiteralTypeNode,
	Identifier,
	isTupleTypeNode,
	TupleTypeNode,
	TypeLiteralNode,
	KeywordTypeNode,
	isArrayTypeNode,
	ArrayTypeNode,
	UnionTypeNode,
	isTypeReferenceNode,
	isInterfaceDeclaration,
	QuestionToken,
	isClassDeclaration,
	isHeritageClause,
	HeritageClause,
	isExpressionWithTypeArguments,
	ExpressionWithTypeArguments,
	ScriptTarget,
	isExportAssignment,
	isExportDeclaration,
	isExpressionStatement,
	isExportSpecifier,
	isNamedExports,
	isImportOrExportSpecifier,
	isNamespaceExportDeclaration,
	NodeFlags,
	isVariableDeclaration,
	isQualifiedName,
	isVariableStatement,
	isVariableDeclarationList,
} from 'typescript/lib/typescript';
import {
	getOptionalGetter,
	KeywordGeneratorHelper,
	ObjectGeneratorHelper,
	getUnionTypeGetter,
	getArrayGenerator,
	getBooleanGenerator,
	getStringGenerator,
	getNumberGenerator,
} from './literalGenerator';

type TypeDeclarationSpec = { identifier?: string; declaration: Node };

function getTypeReferenceId(node: Node): string | undefined {
	let id: string;
	if (isTypeReferenceNode(node)) {
		node.forEachChild((child: Node) => {
			if (isIdentifier(child)) {
				id = child.text;
			}
		});
	}
	return id;
}

function buildOptionalGetter(isOptional: boolean, getter: ObjectGeneratorHelper | KeywordGeneratorHelper, defaultValue?: any): ObjectGeneratorHelper {
	if (isOptional) {
		return getOptionalGetter(getter, defaultValue);
	}
	return getter;
}

function visitLiteralTypeNodeChildren(node: LiteralTypeNode, cb: (child: LiteralExpression) => void): void {
	if (isLiteralTypeNode(node)) {
		node.forEachChild(cb);
	}
}

type Generator = {
	identifier?: string;
	get: () => any;
};

type Export = {
	name: string;
	isDefault: boolean;
};

type ReactExport = {
	name?: string;
	isDefault: boolean;
	props: ObjectGeneratorHelper;
};

/**
 * we have independent types and then types that are dependent on other types
 * we have incrementally built generators
 */

export default class Parser {
	typeMap: { [typeName: string]: ObjectGeneratorHelper | KeywordGeneratorHelper } = {};

	defaultReactExport?: ReactExport;

	reactExports: ReactExport[] = [];

	exports: Export[] = [];

	static build(fileName: string, fileContents: string, scriptTarget?: ScriptTarget): Parser {
		const out = createSourceFile(fileName, fileContents, scriptTarget || ScriptTarget.ES5);
		const parser = new Parser();
		parser.findTypeDeclarations(out);
		parser.exports.forEach((exp: Export) => {
			if (exp.isDefault) {
				const defaultReactExport = parser.reactExports.find((reactExport: ReactExport) => reactExport.name === exp.name);
				if (defaultReactExport !== undefined) {
					parser.defaultReactExport = {
						...defaultReactExport,
						isDefault: true
					};
				}
			}
		});
		return parser;
	}

	/**
	 * strategy
	 * get to a type declaration
	 * map type declaration into generators
	 */
	getUnionTypeGenerator = (declarationSpec: TypeDeclarationSpec, pathString: string): Generator | undefined => {
		const identifier = declarationSpec.identifier;
		const node = declarationSpec.declaration
		if (isUnionTypeNode(node)) {
			const generator = this.getUnionType(node, pathString);
			if (generator) {
				return {
					identifier,
					get: generator,
				};
			}
		}
		return;
	}

	getUnionType(node: UnionTypeNode, pathString): ObjectGeneratorHelper | undefined {
		let unionGeneratorLiterals: ObjectGeneratorHelper[];
		node.forEachChild((unionLiteral: Node) => {
			if (isTypeReferenceNode(unionLiteral)) {
				const typeName = getTypeReferenceId(unionLiteral);
				if (typeName !== undefined) {
					if (!unionGeneratorLiterals) {
						unionGeneratorLiterals = [];
					}
					unionGeneratorLiterals.push(() => {
						if (this.typeMap[typeName]) {
							return this.typeMap[typeName]();
						}
						return;
					});
				}
			} else if (isLiteralTypeNode(unionLiteral)) {
				const literals = this.getStringsOrNumbers(node)
				unionGeneratorLiterals = literals;
			} else if (isTypeLiteralNode(unionLiteral)) {
				const literals = this.getUnionedObjects(node, pathString)
				unionGeneratorLiterals = literals;
			} else if (isTupleTypeNode(unionLiteral)) {
				const literals = this.getUnionedArrays(node, pathString);
				unionGeneratorLiterals = literals;
			}
		});

		if (unionGeneratorLiterals !== undefined) {
			return getUnionTypeGetter(unionGeneratorLiterals);
		}
		return;
	}

	getUnionedArrays(node: Node, path: string): ObjectGeneratorHelper[] {
		let literals: any[] = [];
		node.forEachChild((child: TupleTypeNode) => {
			const a = this.getArrayLiteral(child, path);
			if (a !== undefined) {
				literals.push(a);
			}
		});
		return literals;
	}

	getArrayLiteral(node: Node, path: string): ObjectGeneratorHelper | undefined {
		let a: ObjectGeneratorHelper[];
		let result: ObjectGeneratorHelper;
		if (isTupleTypeNode(node)) {
			node.forEachChild((literalChild: LiteralTypeNode) => {
				const literal = this.getTypeLiteralType(literalChild, path);
				if (literal !== undefined) {
					if (a === undefined) {
						a = [];
					}
					a.push(literal);
				}
			});
		}

		if (a !== undefined) {
			result = () => a.map(helper => helper());
		}
		return result;
	}

	getUnionedObjects(node: Node, pathString: string): ObjectGeneratorHelper[] {
		let literals: any[] = [];
		node.forEachChild((child: TypeLiteralNode) => {
			const o = this.getObjectLiteral(child, pathString);
			if (o !== undefined) {
				literals.push(o);
			}
		});
		return literals;
	}

	getObjectLiteral(node: TypeLiteralNode, pathString: string): ObjectGeneratorHelper | undefined {
		let helpers: ObjectGeneratorHelper[];
		let o: ObjectGeneratorHelper
		node.forEachChild((literalChild: Node) => {
			if (isPropertySignature(literalChild)) {
				const literal = this.getObjectSubLiteral(literalChild, pathString);
				if (literal !== undefined) {
					if (helpers === undefined) {
						helpers = [];
					}
					helpers.push(literal);
				}
			}
		});
		if (helpers) {
			o = () => {
				return helpers.reduce((acc: object, nextHelper: ObjectGeneratorHelper) => ({
					...acc,
					...nextHelper()
				}), {});
			};
		}
		return o;
	}

	getObjectSubLiteral(node: PropertySignature, pathString: string): ObjectGeneratorHelper {
		let o: ObjectGeneratorHelper;
		let inProgressKey;
		let isOptional: boolean = false;
		node.forEachChild((child: Identifier | LiteralTypeNode | KeywordTypeNode | QuestionToken) => {
			if (child.kind === SyntaxKind.QuestionToken) {
				isOptional = true;
			} else if (isIdentifier(child)) {
				inProgressKey = child.text;
			} else {
				if (inProgressKey !== undefined) {
					if (isTypeReferenceNode(child)) {
						const reference = getTypeReferenceId(child);
						if (reference !== undefined) {
							o = buildOptionalGetter(isOptional, () => {
								const getter = this.typeMap[reference];
								if (getter !== undefined) {
									return {
										[inProgressKey]: getter(),
									};
								}
								return {};
							}, {});
						}
					} else if (isUnionTypeNode(child)) {
						const generator = this.getUnionType(child, pathString + inProgressKey);
						if (generator !== undefined) {
							o = buildOptionalGetter(isOptional, () => ({
								[inProgressKey]: generator(),
							}), {});
						}
					} else if (isLiteralTypeNode(child) || isTupleTypeNode(child)) {
						const literal = this.getTypeLiteralType(child, pathString + inProgressKey);
						if (literal !== undefined) {
							o = buildOptionalGetter(isOptional, () => {
								return {
									[inProgressKey]:  literal(),
								};
							}, {});
						}
					} else {
						// sub type is a key word
						const generator = this.getKeywordGeneratorHelper(child, pathString + inProgressKey)
						if (generator !== undefined) {
							o = buildOptionalGetter(isOptional, () => ({
								[inProgressKey]: generator(),
							}), {});
						}
					}
				}
			}
		});
		return o;
	}

	getKeywordGeneratorHelper(node: KeywordTypeNode, pathString: string): KeywordGeneratorHelper | undefined {
		if (node.kind === SyntaxKind.StringKeyword) {
			return getStringGenerator(pathString);
		}

		if (node.kind === SyntaxKind.NumberKeyword) {
			return getNumberGenerator(pathString);
		}

		if (node.kind === SyntaxKind.BooleanKeyword) {
			return getBooleanGenerator();
		}

		if (node.kind === SyntaxKind.ObjectKeyword) {
			return () => ({});
		}

		if (node.kind === SyntaxKind.UndefinedKeyword) {
			return () => undefined;
		}

		if (node.kind === SyntaxKind.NullKeyword) {
			return () => null;
		}

		if (node.kind === SyntaxKind.AnyKeyword) {
			return () => undefined;
		}

		if (isArrayTypeNode(node)) {
			return this.getArrayType(node, pathString);
		}

		if (isTypeLiteralNode(node)) {
			// is an object literal probably
			const literal = this.getTypeLiteralType(node, pathString);
			if (literal !== undefined) {
				return literal;
			}
		}

		return;
	}

	getNumberOrString(node: LiteralTypeNode): ObjectGeneratorHelper | undefined {
		let literal: ObjectGeneratorHelper;
		visitLiteralTypeNodeChildren(node, (literalChild: LiteralExpression) => {
			if (isNumericLiteral(literalChild)) {
				literal = () => parseFloat(literalChild.text);
			} else {
				literal = () => literalChild.text;
			}
		});
		return literal;
	}

	getStringsOrNumbers(node: Node): ObjectGeneratorHelper[] {
		let literals: ObjectGeneratorHelper[] = [];
		node.forEachChild((child: LiteralTypeNode) => {
			const literal = this.getNumberOrString(child);
			if (literal !== undefined) {
				literals.push(literal);
			}
		});
		return literals
	}

	getOptionalInterfaceTypeDeclaration = (node: Node): TypeDeclarationSpec | undefined => {
		if (isInterfaceDeclaration(node)) {
			let identifier;
			let declaration;
			node.forEachChild((child: Node) => {
				if (isIdentifier(child)) {
					identifier = child.text;
					declaration = node;
				}
			});
			if (declaration !== undefined) {
				return {
					identifier,
					declaration: node,
				};
			}
		}
		return;
	}

	getOptionalIdentifierAndTypeDeclaration = (node: Node): TypeDeclarationSpec | undefined => {
		let identifier: string | undefined = undefined;
		let declaration: Node | undefined = undefined;
		node.forEachChild((child: Node) => {
			if (isIdentifier(child)) {
				identifier = child.text
			}
			if (isTypeNode(child)) {
				declaration = child
			}
		});

		if (declaration !== undefined) {
			return {
				declaration,
				identifier,
			};
		}
		return;
	}

	getArrayType(node: ArrayTypeNode, pathString: string): ObjectGeneratorHelper | undefined {
		let a: ObjectGeneratorHelper;
		node.forEachChild((child: KeywordTypeNode | LiteralTypeNode) => {
			if (isTypeReferenceNode(child)) {
				const id = getTypeReferenceId(child);
				if (id !== undefined) {
					a = getArrayGenerator(() => {
						const getter = this.typeMap[id];
						if (getter !== undefined) {
							return getter();
						}
						return;
					});
				}
			} else if (isUnionTypeNode(child)) {
				const literal = this.getUnionType(child, pathString);
				if (literal !== undefined) {
					a = getArrayGenerator(literal);
				}
			} else if (isLiteralTypeNode(child)) {
				const literalGenerator = this.getTypeLiteralType(child, pathString);
				if (literalGenerator !== undefined) {
					a = getArrayGenerator(literalGenerator);
				}
			} else {
				// sub type is a key word
				const keywordGenerator = this.getKeywordGeneratorHelper(child, pathString)
				if (keywordGenerator !== undefined) {
					a = getArrayGenerator(keywordGenerator);
				}
			}

		});
		return a;
	}

	getTypeLiteralType(node: Node, pathString: string): ObjectGeneratorHelper | undefined {
		if (isTypeLiteralNode(node)) {
			const o = this.getObjectLiteral(node, pathString);
			if (o !== undefined) {
				return o;
			}
		}

		if (isTupleTypeNode(node)) {
			const a = this.getArrayLiteral(node, pathString);
			if (a !== undefined) {
				return a;
			}
		}

		if (isArrayTypeNode(node)) {
			const a = this.getArrayType(node, pathString);
			if (a !== undefined) {
				return a;
			}
		}

		if (isLiteralTypeNode(node)) {
			// continue
			const literal = this.getNumberOrString(node);
			if (literal !== undefined) {
				return literal;
			}
		}
		return;
	}

	getTypeLiteralTypeFromDeclarationSpec = (declarationSpec: TypeDeclarationSpec): Generator | undefined => {
		const node = declarationSpec.declaration
		const identifier = declarationSpec.identifier || '';
		const literal = this.getTypeLiteralType(node, identifier);
		if (literal !== undefined) {
			return {
				identifier,
				get: literal,
			}
		}
		return;
	}

	getInterface = (declarationSpec: TypeDeclarationSpec, pathString: string): Generator | undefined => {
		const node = declarationSpec.declaration
		const identifier = declarationSpec.identifier || '';
		if (isInterfaceDeclaration(node)) {
			let helpers: ObjectGeneratorHelper[];
			node.forEachChild((literalChild: Node) => {
				if (isPropertySignature(literalChild)) {
					const literal = this.getObjectSubLiteral(literalChild, pathString);
					if (literal !== undefined) {
						if (helpers === undefined) {
							helpers = [];
						}
						helpers.push(literal);
					}
				}
			});
			if (helpers !== undefined) {
				return {
					identifier,
					get: () => {
						return helpers.reduce((acc: object, nextHelper: ObjectGeneratorHelper) => ({
							...acc,
							...nextHelper()
						}), {});
					},
				};
			}
		}
		return;
	}

	parseReactComponentDeclaration(node: ExpressionWithTypeArguments, pathString: string): ObjectGeneratorHelper | undefined {
		let propGenerator: ObjectGeneratorHelper;
		node.forEachChild((child: Node) => {
			if (isTypeReferenceNode(child)) {
				const identifier = getTypeReferenceId(child);
				if (identifier !== undefined) {
					propGenerator = () => {
						const getter = this.typeMap[identifier];
						if (getter !== undefined) {
							return getter();
						}
					};
				}
			} else if (isTypeLiteralNode(child)) {
				const literal = this.getTypeLiteralType(child, pathString);
				if (literal !== undefined) {
					propGenerator = literal;
				}
			}
		});

		return propGenerator;
	}

	getPropGenerator(node: HeritageClause, pathString: string): ObjectGeneratorHelper | undefined {
		let propGenerator: ObjectGeneratorHelper;
		node.forEachChild((child: Node) => {
			if (propGenerator === undefined) {
				if (isExpressionWithTypeArguments(child)) {
					const component = this.parseReactComponentDeclaration(child, pathString);
					if (component !== undefined) {
						propGenerator = component;
					}
				}
			}
		});
		return propGenerator;
	}

	isDefaultExport(node: Node): boolean {
		let isExport: boolean = false;
		let isDefault: boolean = false;
		node.forEachChild((child: Node) => {
			if (child.kind === SyntaxKind.DefaultKeyword) {
				isDefault = true;
			}
			if (child.kind === SyntaxKind.ExportKeyword) {
				isExport = true;
			}
		});
		return isExport && isDefault;
	}

	getClass = (declarationSpec: TypeDeclarationSpec, pathString: string): ReactExport | undefined => {
		const node = declarationSpec.declaration;
		const identifier = declarationSpec.identifier;
		if (isClassDeclaration(node)) {
			let propGenerator: ObjectGeneratorHelper;
			node.forEachChild((child: Node) => {
				if (isHeritageClause(child)) {
					// get type info for extends clause
					// if doesn't have a heritage clause definitely not a react class component
					propGenerator = this.getPropGenerator(child, pathString);
				}
			});
			if (propGenerator !== undefined) {
				return {
					isDefault: this.isDefaultExport(node),
					name: identifier,
					props: propGenerator,
				};
			}
		}
		return;
	}

	getTypeDeclaration(declarationSpec: TypeDeclarationSpec): Generator | undefined {
		const typeGetters = [
			this.getInterface,
			this.getUnionTypeGenerator,
			this.getTypeLiteralTypeFromDeclarationSpec,
		];
		let typeIndex = 0;
		let foundType;
		while (foundType === undefined && typeIndex < typeGetters.length) {
			foundType = typeGetters[typeIndex](declarationSpec, declarationSpec.identifier);
			typeIndex += 1;
		}
		return foundType;
	}

	getOptionalClassDeclaration = (node: Node): TypeDeclarationSpec | undefined => {
		if (isClassDeclaration(node)) {
			let identifier: string;
			node.forEachChild((child: Node) => {
				if (isIdentifier(child)) {
					identifier = child.text
				}
			});
			if (identifier !== undefined) {
				return {
					identifier,
					declaration: node,
				};
			}
		}
		return;
	}

	getOptionalStatelessComponentDeclaration = (node: Node): TypeDeclarationSpec | undefined => {
		if (isVariableStatement(node)) {
			let elementName: string;
			let propName: string;
			node.forEachChild((child: Node) => {
				if (isVariableDeclarationList(child)) {
					child.forEachChild((decList: Node) => {
						if (isVariableDeclaration(decList)) {
							decList.forEachChild((dec: Node) => {
								if (isIdentifier(dec)) {
									elementName = dec.text;
								}
							});
						}
					});
				}
			});
			if (elementName !== undefined) {
				return {
					declaration: node,
					identifier: elementName,
				};
			}

		}
		return;
	}

	getTypeDeclarationSpec(node: Node): TypeDeclarationSpec | undefined {
		const declarationSpecGetters = [
			this.getOptionalStatelessComponentDeclaration,
			this.getOptionalClassDeclaration,
			this.getOptionalInterfaceTypeDeclaration,
			this.getOptionalIdentifierAndTypeDeclaration,
		];
		let typeIndex = 0;
		let foundType;
		while (foundType === undefined && typeIndex < declarationSpecGetters.length) {
			foundType = declarationSpecGetters[typeIndex](node);
			typeIndex += 1;
		}
		return foundType;
	}

	getElement = (declarationSpec: TypeDeclarationSpec, pathString: string): ReactExport | undefined => {
		const node = declarationSpec.declaration;
		const name = declarationSpec.identifier;

		if (isVariableStatement(node)) {
			let elementName: string;
			let propName: string;
			node.forEachChild((child: Node) => {
				if (isVariableDeclarationList(child)) {
					child.forEachChild((decList: Node) => {
						if (isVariableDeclaration(decList)) {
							decList.forEachChild((dec: Node) => {
								if (isTypeReferenceNode(dec)) {
									dec.forEachChild((typeDeclaration: Node) => {
										if (isTypeReferenceNode(typeDeclaration)) {
											typeDeclaration.forEachChild((a: Node) => {
												if (isIdentifier(a)) {
													propName = a.text;
												}
											});
										}
									});
								}
							});
						}
					});
				}
			});
			if (propName !== undefined) {
				return {
					isDefault: false,
					name,
					props: () => {
						const getter = this.typeMap[propName];
						if (getter !== undefined) {
							return getter();
						}
					},
				};
			}
		}
		return;
	}

	getReactComponent(declarationSpec: TypeDeclarationSpec): ReactExport | undefined {
		const typeGetters = [this.getClass, this.getElement];
		let typeIndex = 0;
		let foundType;
		while (foundType === undefined && typeIndex < typeGetters.length) {
			foundType = typeGetters[typeIndex](declarationSpec, declarationSpec.identifier);
			typeIndex += 1;
		}
		return foundType;
	}

	getExport(node: Node): Export | undefined {
		let isExport: boolean = false;
		let isDefault: boolean = false;
		let name: string;

		node.forEachChild((child: Node) => {
			if (isExportAssignment(child)) {
				isExport = true;
				child.forEachChild((exportChild: Node) => {
					if (isIdentifier(exportChild)) {
						name = exportChild.text;
						isDefault = true;
					}
				});
			}
			if (child.kind === SyntaxKind.DefaultKeyword) {
				isDefault = true;
			}
			if (child.kind === SyntaxKind.ExportKeyword) {
				isExport = true;
			}
			if (isIdentifier(child)) {
				name = child.text;
			}
			const typeRef = getTypeReferenceId(child);
			if (typeRef !== undefined) {
				name = typeRef;
			}
		});
		if (isExport && name !== undefined) {
			return {
				isDefault,
				name,
			};
		}
		return;
	}

	findTypeDeclarations(node: Node): Generator[] {
		let generators: Generator[] = [];
		if (node.kind !== SyntaxKind.EndOfFileToken) {
			const foundExport = this.getExport(node);
			if (foundExport !== undefined) {
				this.exports.push(foundExport);
			}

			const typeDecSpec = this.getTypeDeclarationSpec(node);
			if (typeDecSpec) {
				const generator = this.getTypeDeclaration(typeDecSpec);
				if (generator) {
					if (generator.identifier) {
						this.typeMap[generator.identifier] = generator.get;
					}
					generators.push(generator);
				} else {
					const reactExport = this.getReactComponent(typeDecSpec);
					if (!!reactExport) {
						this.reactExports.push(reactExport);
						if (reactExport.isDefault) {
							this.defaultReactExport = reactExport;
						}
					}
				}
			} else {
				node.forEachChild((child: Node) => {
					const possibleGenerators = this.findTypeDeclarations(child);
					generators = generators.concat(possibleGenerators);
				});
			}
		}

		return generators;
	}
 }