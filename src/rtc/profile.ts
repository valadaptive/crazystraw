import Identity from './identity';

class Profile {
    public identity: Identity;
    public handle: string;
    public avatar: Blob | null;
    public bio: string | null;

    constructor (
        identity: Identity,
        handle: string,
        avatar: Blob | null,
        bio: string | null
    ) {
        this.identity = identity;
        this.handle = handle;
        this.avatar = avatar;
        this.bio = bio;
    }

    public async export (password: string): Promise<string> {
        const exportedIdentity = await this.identity.export(password);
        return JSON.stringify({
            identity: exportedIdentity,
            handle: this.handle,
            avatar: this.avatar,
            bio: this.bio
        });
    }
}

export default Profile;
