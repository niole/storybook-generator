import { PropertySignature, createSourceFile, Node, ScriptTarget, SyntaxKind, isTypeAliasDeclaration, isIdentifier, isUnionTypeNode, isLiteralTypeNode, isStringLiteral, isNumericLiteral, isBigIntLiteral, SourceFile, isTypeNode, isTypeLiteralNode, isPropertySignature, LiteralType, isWhiteSpaceLike, tokenToString, isToken, Token, LiteralExpression, LiteralTypeNode, isArrayLiteralExpression, isObjectLiteralExpression, Identifier, isTupleTypeNode, LiteralLikeNode, TupleTypeNode, TypeLiteralNode } from 'typescript/lib/typescript';

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
function getUnionType(declarationSpec: TypeDeclarationSpec, sourceFile?: SourceFile): Generator | undefined {
	const identifier = declarationSpec.identifier;
	const node = declarationSpec.declaration
	if (isUnionTypeNode(node)) {
		let unionGeneratorLiterals = [];
		node.forEachChild((unionLiteral: Node) => {
			if (isLiteralTypeNode(unionLiteral)) {
				const literals = getStringsOrNumbers(node)
				unionGeneratorLiterals = unionGeneratorLiterals.concat(literals);
			} else if (isTypeLiteralNode(unionLiteral)) {
				const literals = getUnionedObjects(node)
				unionGeneratorLiterals = unionGeneratorLiterals.concat(literals);
			} else if (isTupleTypeNode(unionLiteral)) {
				const literals = getUnionedArrays(node);
				unionGeneratorLiterals = unionGeneratorLiterals.concat(literals);
			}
		});
		return {
			identifier,
			get: getUnionTypeGetter(unionGeneratorLiterals),
		};
	}
	return;
}

function getUnionedArrays(node: Node): any[][] {
	let literals: any[] = [];
	node.forEachChild((child: TupleTypeNode) => {
		const a = [];
		child.forEachChild((literalChild: LiteralTypeNode) => {
			if (isLiteralTypeNode(literalChild)) {
				visitLiteralTypeNodeChildren(literalChild, (expr: LiteralExpression) => {
					const literal = getNumberOrString(expr);
					if (literal !== undefined) {
						a.push(literal);
					}
				});
			}
		});
		literals.push(a);
	});
	return literals;
}

function getUnionedObjects(node: Node): object[] {
	let literals: any[] = [];
	node.forEachChild((child: TypeLiteralNode) => {
		let o = {};
		child.forEachChild((literalChild: Node) => {
			if (isPropertySignature(literalChild)) {
				const literal = getObjectLiteral(literalChild);
				if (literal !== undefined) {
					o = {...o, ...literal};
				}
			}
		});
		literals.push(o);
	});
	return literals;
}

function getObjectLiteral(node: PropertySignature): object {
	const o = {};
	let inProgressKey;
	node.forEachChild((child: Identifier | LiteralTypeNode) => {
			if (isIdentifier(child)) {
				inProgressKey = child.text;
			} else if (isLiteralTypeNode(child)) {
				visitLiteralTypeNodeChildren(child, (literalChild: LiteralExpression) => {
					const literal = getNumberOrString(literalChild);
					if (literal !== undefined && inProgressKey !== undefined) {
						o[inProgressKey] = literal;
						inProgressKey = undefined;
					}
				});
			}
	});
	return o;
}

function getNumberOrString(literalChild: LiteralLikeNode): number | string | undefined {
	if (isNumericLiteral(literalChild)) {
		return parseFloat(literalChild.text);
	}
	return literalChild.text;
}

function getStringsOrNumbers(node: Node): any[] {
	let literals: any[] = [];
	node.forEachChild((child: LiteralTypeNode) => {
		visitLiteralTypeNodeChildren(child, (literalChild: LiteralExpression) => {
			const literal = getNumberOrString(literalChild);
			if (literal !== undefined) {
				literals.push(literal);
			}
		})
	});
	return literals;
}

function visitLiteralTypeNodeChildren(node: LiteralTypeNode, cb: (child: LiteralExpression) => void): void {
	if (isLiteralTypeNode(node)) {
		node.forEachChild(cb);
	}
}

type TypeDeclarationSpec = { identifier?: string; declaration: Node };
function getOptionalIdentifierAndTypeDeclaration(node: Node, sourceFile?: SourceFile): TypeDeclarationSpec | undefined {
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

function getTypeDeclaration(declarationSpec: TypeDeclarationSpec): Generator | undefined {
	return getUnionType(declarationSpec);
}

function getUnionTypeGetter(literals: any[]): () => any {
	let totalCalls = -1;
	return () => {
		totalCalls += 1;
		return literals[totalCalls % literals.length];
	};
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
				generators = generators.concat(generators);
			}
		}
	});
	return generators;
}