import * as React from 'react';

const Component: React.SFC<{ name: string; phoneNumber: number}> = ({ name, phoneNumber }) => (
    <div>
        <strong>{name}</strong>
        <div>{phoneNumber}</div>
    </div>
);

export default Component;