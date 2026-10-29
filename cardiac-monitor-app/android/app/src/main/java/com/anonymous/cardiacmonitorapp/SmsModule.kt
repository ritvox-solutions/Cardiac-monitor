package com.anonymous.cardiacmonitorapp

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.telephony.SmsManager
import android.telephony.SubscriptionManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** Sends emergency messages through the Android device's configured SIM. */
class SmsModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName(): String = "SmsModule"

  @ReactMethod
  fun sendSms(phoneNumber: String, message: String, promise: Promise) {
    if (phoneNumber.isBlank() || message.isBlank()) {
      promise.reject("INVALID_SMS", "Phone number and message are required")
      return
    }

    val cleanNumber = phoneNumber.replace(Regex("[^0-9+]"), "")
    if (cleanNumber.isBlank() || cleanNumber.length < 5) {
      promise.reject("INVALID_SMS", "Phone number '$phoneNumber' is invalid.")
      return
    }

    if (cleanNumber.contains("5550124") || cleanNumber.contains("5550125") || cleanNumber.startsWith("+1555")) {
      promise.reject(
        "DUMMY_PHONE_NUMBER",
        "'$phoneNumber' is a fictional dummy number. Please set a REAL emergency contact phone number in Settings."
      )
      return
    }

    if (reactApplicationContext.checkSelfPermission(Manifest.permission.SEND_SMS) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      promise.reject("SMS_PERMISSION_DENIED", "SEND_SMS permission has not been granted")
      return
    }

    try {
      val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val subId = SubscriptionManager.getDefaultSmsSubscriptionId()
        if (subId != SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
          reactApplicationContext.getSystemService(SmsManager::class.java).createForSubscriptionId(subId)
        } else {
          reactApplicationContext.getSystemService(SmsManager::class.java)
        }
      } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
        val subId = SmsManager.getDefaultSmsSubscriptionId()
        if (subId != SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
          @Suppress("DEPRECATION")
          SmsManager.getSmsManagerForSubscriptionId(subId)
        } else {
          @Suppress("DEPRECATION")
          SmsManager.getDefault()
        }
      } else {
        @Suppress("DEPRECATION")
        SmsManager.getDefault()
      }

      val parts = smsManager.divideMessage(message)
      if (parts.size == 1) {
        smsManager.sendTextMessage(cleanNumber, null, message, null, null)
      } else {
        smsManager.sendMultipartTextMessage(cleanNumber, null, parts, null, null)
      }
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("SMS_SEND_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun openSmsApp(phoneNumber: String, message: String, promise: Promise) {
    try {
      val cleanNumber = phoneNumber.replace(Regex("[^0-9+]"), "")
      val intent = Intent(Intent.ACTION_SENDTO).apply {
        data = Uri.parse("smsto:$cleanNumber")
        putExtra("sms_body", message)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactApplicationContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("OPEN_SMS_FAILED", error.message, error)
    }
  }
}
