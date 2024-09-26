'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { collection, doc, getDoc, getDocs, query, setDoc, where, deleteDoc, Timestamp, writeBatch } from 'firebase/firestore'

import { auth } from '@/auth'
import { type Chat } from '@/lib/types'
import { db } from '@/firebase'

// Helper function to convert Firestore Timestamp to ISO string
function convertTimestampToString(timestamp: Timestamp): string {
  return timestamp.toDate().toISOString();
}

// Modify this function to convert Timestamp objects
function convertChat(chat: any): Chat {
  return {
    ...chat,
    createdAt: chat.createdAt ? convertTimestampToString(chat.createdAt) : null,
    // Convert other Timestamp fields if any
  };
}

export async function getChats(userId?: string | null) {
  const session = await auth()

  if (!userId) {
    return []
  }

  if (userId !== session?.user?.id) {
    return {
      error: 'Unauthorized'
    }
  }

  try {
    const chatsRef = collection(db, 'chats')
    const q = query(chatsRef, where('userId', '==', userId))
    const querySnapshot = await getDocs(q)

    return querySnapshot.docs.map(doc => convertChat(doc.data() as Chat))
    
  } catch (error) {
    console.error('Error fetching chats:', error)
    return { error: 'Failed to fetch chats' }
  }
}

export async function getChat(id: string, userId: string) {
  const session = await auth()

  if (userId !== session?.user?.id) {
    return {
      error: 'Unauthorized'
    }
  }

  const chatDoc = await getDoc(doc(db, 'chats', id))

  if (!chatDoc.exists() || (userId && chatDoc.data()?.userId !== userId)) {
    return null
  }

  const chatData = chatDoc.data() as Chat;
  return convertChat(chatData);
}

export async function removeChat({ id, path }: { id: string; path: string }) {
  const session = await auth()

  if (!session) {
    return {
      error: 'Unauthorized'
    }
  }

  const chatDoc = await getDoc(doc(db, 'chats', id))

  if (!chatDoc.exists() || chatDoc.data()?.userId !== session.user?.id) {
    return {
      error: 'Unauthorized'
    }
  }

  await deleteDoc(doc(db, 'chats', id))

  revalidatePath('/')
  return revalidatePath(path)
}

export async function clearChats() {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      error: 'Unauthorized'
    }
  }

  const chatsRef = collection(db, 'chats')
  const q = query(chatsRef, where('userId', '==', session.user.id))
  const querySnapshot = await getDocs(q)

  if (querySnapshot.empty) {
    return redirect('/')
  }
  
  const batch = writeBatch(db);
  querySnapshot.forEach((doc) => {
    batch.delete(doc.ref)
  })

  await batch.commit()

  revalidatePath('/')
  return redirect('/')
}

export async function getSharedChat(id: string) {
  const chatDoc = await getDoc(doc(db, 'chats', id))

  if (!chatDoc.exists() || !chatDoc.data()?.sharePath) {
    return null
  }

  return chatDoc.data() as Chat
}

export async function shareChat(id: string) {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      error: 'Unauthorized'
    }
  }

  const chatDoc = await getDoc(doc(db, 'chats', id))

  if (!chatDoc.exists() || chatDoc.data()?.userId !== session.user.id) {
    return {
      error: 'Something went wrong'
    }
  }

  const chat = chatDoc.data() as Chat
  const payload = {
    ...chat,
    sharePath: `/share/${chat.id}`
  }

  await setDoc(doc(db, 'chats', chat.id), payload)

  return payload
}

export async function saveChat(chat: Chat) {
  const session = await auth()

  if (session && session.user) {
    await setDoc(doc(db, 'chats', chat.id), chat)
  } else {
    return
  }
}

export async function refreshHistory(path: string) {
  redirect(path)
}

export async function getMissingKeys() {
  const keysRequired = ['OPENAI_API_KEY']
  return keysRequired
    .map(key => (process.env[key] ? '' : key))
    .filter(key => key !== '')
}