import { PropertySignature, createSourceFile, Node, ScriptTarget, SyntaxKind, isIdentifier, isUnionTypeNode, isLiteralTypeNode, isNumericLiteral, isTypeNode, isTypeLiteralNode, isPropertySignature, LiteralExpression, LiteralTypeNode, Identifier, isTupleTypeNode, TupleTypeNode, TypeLiteralNode, KeywordTypeNode, isArrayTypeNode, ArrayTypeNode, UnionTypeNode } from 'typescript/lib/typescript';
import {
	KeywordGeneratorHelper,
	ObjectGeneratorHelper,
	getUnionTypeGetter,
	getArrayGenerator,
	getBooleanGenerator,
	getStringGenerator,
	getNumberGenerator,
} from './literalGenerator';

/**
 * looking out for things like the following
 * EnumDeclaration
 * InterfaceDeclaration
 * TypeAliasDeclaration 
 * ClassDeclaration
 * MergeDeclarationMarker
 * UnionType
 * 
 * Identifier TypeLiteral PropertySignature Identifier  NumberKeyword
 */

const out = createSourceFile('x.ts', 'type X = { x: number; }', ScriptTarget.ES5);
function catNode(node: Node, depth: number = 0): void {
	return node.forEachChild(n => catNode(n, depth + 1));
}
const stringUnion = `type Name = 'a' | 'b' | 'c';`;
const reactComponent = `
type Name = 'a' | 'b' | 'c';
enum Number = {
	one = 1,
	two = 2,
};
interface Props {
	name: Name;
	number: Number;
	occupation: string;
	vehicle: { wheels: number; legs: number };
}
const R: React.SFC<Props> = props => (
	<div {...props} />
);
export default R;`;

type Type = {
};
type Types = {
	defaultExport: Type;
	exports: Type[];
};
function getTypesForExports(fileContent: string): Types {
	return {
		defaultExport: {},
		exports: [],
	}
}

type Generator = {
	identifier?: string;
	get: () => any;
};

/**
 * strategy
 * get to a type declaration
 * map type declaration into generators
 */
function getUnionTypeGenerator(declarationSpec: TypeDeclarationSpec, pathString: string): Generator | undefined {
	const identifier = declarationSpec.identifier;
	const node = declarationSpec.declaration
	if (isUnionTypeNode(node)) {
		const generator = getUnionType(node, pathString);
		if (generator) {
			return {
				identifier,
				get: generator,
			};
		}
	}
	return;
}

function getUnionType(node: UnionTypeNode, pathString): ObjectGeneratorHelper | undefined {
	let unionGeneratorLiterals: ObjectGeneratorHelper[];
	node.forEachChild((unionLiteral: Node) => {
		if (isLiteralTypeNode(unionLiteral)) {
			const literals = getStringsOrNumbers(node)
			unionGeneratorLiterals = literals;
		} else if (isTypeLiteralNode(unionLiteral)) {
			const literals = getUnionedObjects(node, pathString)
			unionGeneratorLiterals = literals;
		} else if (isTupleTypeNode(unionLiteral)) {
			const literals = getUnionedArrays(node, pathString);
			unionGeneratorLiterals = literals;
		}
	});

	if (unionGeneratorLiterals !== undefined) {
		return getUnionTypeGetter(unionGeneratorLiterals);
	}
	return;
}

function getUnionedArrays(node: Node, path: string): ObjectGeneratorHelper[] {
	let literals: any[] = [];
	node.forEachChild((child: TupleTypeNode) => {
		const a = getArrayLiteral(child, path);
		if (a !== undefined) {
			literals.push(a);
		}
	});
	return literals;
}

function getArrayLiteral(node: Node, path: string): ObjectGeneratorHelper | undefined {
	let a: ObjectGeneratorHelper[];
	let result: ObjectGeneratorHelper;
	if (isTupleTypeNode(node)) {
		node.forEachChild((literalChild: LiteralTypeNode) => {
			const literal = getTypeLiteralType(literalChild, path);
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

function getUnionedObjects(node: Node, pathString: string): ObjectGeneratorHelper[] {
	let literals: any[] = [];
	node.forEachChild((child: TypeLiteralNode) => {
		const o = getObjectLiteral(child, pathString);
		if (o !== undefined) {
			literals.push(o);
		}
	});
	return literals;
}

function getObjectLiteral(node: TypeLiteralNode, pathString: string): ObjectGeneratorHelper | undefined {
	let helpers: ObjectGeneratorHelper[];
	let o: ObjectGeneratorHelper
	node.forEachChild((literalChild: Node) => {
		if (isPropertySignature(literalChild)) {
			const literal = getObjectSubLiteral(literalChild, pathString);
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

function getObjectSubLiteral(node: PropertySignature, pathString: string): ObjectGeneratorHelper {
	let o: ObjectGeneratorHelper;
	let inProgressKey;
	node.forEachChild((child: Identifier | LiteralTypeNode | KeywordTypeNode) => {
		if (isIdentifier(child)) {
			inProgressKey = child.text;
		} else {
			if (inProgressKey !== undefined) {
				if (isUnionTypeNode(child)) {
					const generator = getUnionType(child, pathString + inProgressKey);
					if (generator !== undefined) {
						o = () => ({
							[inProgressKey]: generator(),
						});
					}
				} else if (isLiteralTypeNode(child) || isTupleTypeNode(child)) {
					const literal = getTypeLiteralType(child, pathString + inProgressKey);
					if (literal !== undefined) {
						o = () => {
							return {
								[inProgressKey]:  literal(),
							};
						};
					}
				} else {
					// sub type is a key word
					const generator = getKeywordGeneratorHelper(child, pathString + inProgressKey)
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

function getKeywordGeneratorHelper(node: KeywordTypeNode, pathString: string): KeywordGeneratorHelper | undefined {
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

	if (isTypeLiteralNode(node)) {
		// is an object literal probably
		const literal = getTypeLiteralType(node, pathString);
		if (literal !== undefined) {
			return literal;
		}
	}

	return;
}

function getNumberOrString(node: LiteralTypeNode): ObjectGeneratorHelper | undefined {
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

function getStringsOrNumbers(node: Node): ObjectGeneratorHelper[] {
	let literals: ObjectGeneratorHelper[] = [];
	node.forEachChild((child: LiteralTypeNode) => {
		const literal = getNumberOrString(child);
		if (literal !== undefined) {
			literals.push(literal);
		}
	});
	return literals
}

function visitLiteralTypeNodeChildren(node: LiteralTypeNode, cb: (child: LiteralExpression) => void): void {
	if (isLiteralTypeNode(node)) {
		node.forEachChild(cb);
	}
}

type TypeDeclarationSpec = { identifier?: string; declaration: Node };
function getOptionalIdentifierAndTypeDeclaration(node: Node): TypeDeclarationSpec | undefined {
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

function getArrayType(node: ArrayTypeNode, pathString: string): ObjectGeneratorHelper | undefined {
	let a: ObjectGeneratorHelper;
	node.forEachChild((child: KeywordTypeNode | LiteralTypeNode) => {
		if (isUnionTypeNode(child)) {
			const literal = getUnionType(child, pathString);
			if (literal !== undefined) {
				a = getArrayGenerator(literal);
			}
		} else if (isLiteralTypeNode(child)) {
			const literalGenerator = getTypeLiteralType(child, pathString);
			if (literalGenerator !== undefined) {
				a = getArrayGenerator(literalGenerator);
			}
		} else {
			// sub type is a key word
			const keywordGenerator = getKeywordGeneratorHelper(child, pathString)
			if (keywordGenerator !== undefined) {
				a = getArrayGenerator(keywordGenerator);
			}
		}

	});
	return a;
}

function getTypeLiteralType(node: Node, pathString: string): ObjectGeneratorHelper | undefined {
	if (isTypeLiteralNode(node)) {
		const o = getObjectLiteral(node, pathString);
		if (o !== undefined) {
			return o;
		}
	}

	if (isTupleTypeNode(node)) {
		const a = getArrayLiteral(node, pathString);
		if (a !== undefined) {
			return a;
		}
	}

	if (isArrayTypeNode(node)) {
		const a = getArrayType(node, pathString);
		if (a !== undefined) {
			return a;
		}
	}

	if (isLiteralTypeNode(node)) {
		// continue
		const literal = getNumberOrString(node);
		if (literal !== undefined) {
			return literal;
		}
	}
	return;
}

function getTypeLiteralTypeFromDeclarationSpec(declarationSpec: TypeDeclarationSpec): Generator | undefined {
	const node = declarationSpec.declaration
	const identifier = declarationSpec.identifier || '';
	const literal = getTypeLiteralType(node, identifier);
	if (literal !== undefined) {
		return {
			identifier,
			get: literal,
		}
	}
	return;
}

function getTypeDeclaration(declarationSpec: TypeDeclarationSpec): Generator | undefined {
	const typeGetters = [getUnionTypeGenerator, getTypeLiteralTypeFromDeclarationSpec];
	let typeIndex = 0;
	let foundType;
	while (foundType === undefined && typeIndex < typeGetters.length) {
		foundType = typeGetters[typeIndex](declarationSpec, declarationSpec.identifier);
		typeIndex += 1;
	}
	return foundType;
}

export function findTypeDeclarations(node: Node): Generator[] {
	let generators: Generator[] = [];
	node.forEachChild((child: Node) => {
		if (node.kind !== SyntaxKind.EndOfFileToken) {
			const typeDecSpec = getOptionalIdentifierAndTypeDeclaration(child);
			if (typeDecSpec) {
				const typeDeclaration = getTypeDeclaration(typeDecSpec);
				if (typeDeclaration) {
					generators.push(typeDeclaration);
				}
			} else if (child.kind !== SyntaxKind.EndOfFileToken) {
				const possibleGenerators = findTypeDeclarations(child);
				generators = generators.concat(possibleGenerators);
			}
		}
	});
	return generators;
}