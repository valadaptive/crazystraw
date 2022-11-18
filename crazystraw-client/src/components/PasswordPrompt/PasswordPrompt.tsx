import type {JSX} from 'preact';

const PasswordPrompt = ({onEnter, message}: {
    onEnter: (value: string) => void,
    message: string
}): JSX.Element => {
    return (
        <div>
            <div>{message}</div>
            <input type="password" onChange={(event): void => {
                onEnter((event.target as HTMLInputElement).value);
            }} />
        </div>
    );
};

export default PasswordPrompt;
