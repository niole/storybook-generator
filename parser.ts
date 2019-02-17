import {
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
} from 'typescript/lib/typescript';
import {
	KeywordGeneratorHelper,
	ObjectGeneratorHelper,
	getUnionTypeGetter,
	getArrayGenerator,
	getBooleanGenerator,
	getStringGenerator,
	getNumberGenerator,
} from './literalGenerator';

type TypeDeclarationSpec = { identifier?: string; declaration: Node };

function visitLiteralTypeNodeChildren(node: LiteralTypeNode, cb: (child: LiteralExpression) => void): void {
	if (isLiteralTypeNode(node)) {
		node.forEachChild(cb);
	}
}

type Generator = {
	identifier?: string;
	get: () => any;
};

/**
 * we have independent types and then types that are dependent on other types
 * we have incrementally built generators
 */

export default class Parser {
	 typeMap: { [typeName: string]: ObjectGeneratorHelper | KeywordGeneratorHelper }
	 constructor() {
		 this.typeMap = {};
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
				// create a type reference map?
				unionLiteral.forEachChild((id: Identifier) => {
					if (!unionGeneratorLiterals) {
						unionGeneratorLiterals = [];
					}
					const typeName = id.text;
					unionGeneratorLiterals.push(() => {
						if (this.typeMap[typeName]) {
							return this.typeMap[typeName]();
						}
						return;
					});
				});
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
		node.forEachChild((child: Identifier | LiteralTypeNode | KeywordTypeNode) => {
			if (isIdentifier(child)) {
				inProgressKey = child.text;
			} else {
				if (inProgressKey !== undefined) {
					if (isUnionTypeNode(child)) {
						const generator = this.getUnionType(child, pathString + inProgressKey);
						if (generator !== undefined) {
							o = () => ({
								[inProgressKey]: generator(),
							});
						}
					} else if (isLiteralTypeNode(child) || isTupleTypeNode(child)) {
						const literal = this.getTypeLiteralType(child, pathString + inProgressKey);
						if (literal !== undefined) {
							o = () => {
								return {
									[inProgressKey]:  literal(),
								};
							};
						}
					} else {
						// sub type is a key word
						const generator = this.getKeywordGeneratorHelper(child, pathString + inProgressKey)
						if (generator !== undefined) {
							o = () => ({
								[inProgressKey]: generator(),
							});
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

	getOptionalIdentifierAndTypeDeclaration(node: Node): TypeDeclarationSpec | undefined {
		// TODO expand to work for interface, enum
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

		if (declaration) {
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
			if (isUnionTypeNode(child)) {
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

	getTypeDeclaration(declarationSpec: TypeDeclarationSpec): Generator | undefined {
		const typeGetters = [this.getUnionTypeGenerator, this.getTypeLiteralTypeFromDeclarationSpec];
		let typeIndex = 0;
		let foundType;
		while (foundType === undefined && typeIndex < typeGetters.length) {
			foundType = typeGetters[typeIndex](declarationSpec, declarationSpec.identifier);
			typeIndex += 1;
		}
		return foundType;
	}

	findTypeDeclarations(node: Node): Generator[] {
		let generators: Generator[] = [];
		node.forEachChild((child: Node) => {
			if (node.kind !== SyntaxKind.EndOfFileToken) {
				const typeDecSpec = this.getOptionalIdentifierAndTypeDeclaration(child);
				if (typeDecSpec) {
					const generator = this.getTypeDeclaration(typeDecSpec);
					if (generator) {
						if (generator.identifier) {
							this.typeMap[generator.identifier] = generator.get;
						}
						generators.push(generator);
					}
				} else if (child.kind !== SyntaxKind.EndOfFileToken) {
					const possibleGenerators = this.findTypeDeclarations(child);
					generators = generators.concat(possibleGenerators);
				}
			}
		});
		return generators;
	}
 }