import {toByteArray, fromByteArray} from 'base64-js';

import {Identity, PersonalIdentity} from './identity';

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
}

class PersonalProfile extends Profile {
    public identity: PersonalIdentity;

    constructor (
        identity: PersonalIdentity,
        handle: string,
        avatar: Blob | null,
        bio: string | null
    ) {
        super(identity, handle, avatar, bio);
        this.identity = identity;
    }

    public async export (password: string): Promise<string> {
        const exportedIdentity = await this.identity.export(password);
        const avatar = this.avatar ? fromByteArray(new Uint8Array(await this.avatar.arrayBuffer())) : null;
        return JSON.stringify({
            identity: exportedIdentity,
            handle: this.handle,
            avatar,
            bio: this.bio
        });
    }

    public static async import (json: string, password: string): Promise<PersonalProfile> {
        const parsedJson = JSON.parse(json) as Partial<Record<string, unknown>>;
        const {handle, bio, avatar: avatarStr, identity: identityJson} = parsedJson;
        if (
            typeof handle !== 'string' ||
            (typeof bio !== 'string' && bio !== null) ||
            (typeof avatarStr !== 'string' && avatarStr !== null) ||
            (typeof identityJson !== 'object' || identityJson === null)
        ) {
            throw new Error('Invalid JSON');
        }

        const identity = await PersonalIdentity.import(identityJson, password);
        const avatar = avatarStr ? new Blob([toByteArray(avatarStr)]) : null;

        return new PersonalProfile(identity, handle, avatar, bio);
    }
}

export {Profile, PersonalProfile};
